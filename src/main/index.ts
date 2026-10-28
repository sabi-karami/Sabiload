import path from 'node:path'
import { statfs } from 'node:fs/promises'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  powerSaveBlocker,
  shell,
  Tray
} from 'electron'
import type { Server } from 'node:http'
import type { SabiEvents } from '../shared/ipc'
import type { IncomingLink, NewDownloadRequest, Settings } from '../shared/types'
import { SettingsStore } from './settings'
import { NetworkService } from './core/networks'
import { DownloadManager } from './core/manager'
import { initDeviceBinding } from './core/net/socket'
import { startBridge } from './bridge'
import { Updater } from './updater'
import { tr } from './i18n'

const isMac = process.platform === 'darwin'
const THEME_BG: Record<string, string> = {
  nebula: '#0b0820',
  aurora: '#04161a',
  royal: '#0a0906',
  pearl: '#f4f2fb'
}

if (!app.requestSingleInstanceLock()) app.quit()
app.setAppUserModelId('com.sabikarami.sabiload')

let win: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let bridge: Server | null = null
let sleepBlock: number | null = null
let bindingOk = true
const pendingLinks: IncomingLink[] = []

const settings = new SettingsStore()
let nets: NetworkService
let manager: DownloadManager
let updater: Updater

function resource(name: string): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', name)
    : path.join(app.getAppPath(), 'resources', name)
}

function send<K extends keyof SabiEvents>(event: K, payload: SabiEvents[K]): void {
  if (win && !win.isDestroyed()) win.webContents.send(`sabi:${event}`, payload)
}

function showWindow(): void {
  if (!win) createWindow()
  else {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}

function deliver(link: IncomingLink): void {
  if (link.source === 'browser' && !settings.get().askBeforeBridge) {
    void manager.add({
      urls: [link.url],
      fileName: link.fileName,
      headers: link.headers,
      referrer: link.referrer,
      start: true
    })
    return
  }
  if (!win || win.webContents.isLoading()) pendingLinks.push(link)
  else send('incoming', link)
  if (link.source !== 'clipboard') showWindow()
}

function createWindow(): void {
  const s = settings.get()
  win = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 940,
    minHeight: 620,
    show: false,
    title: 'Sabiload',
    backgroundColor: THEME_BG[s.theme] ?? '#0b0820',
    icon: resource('icon.png'),
    titleBarStyle: 'hidden',
    ...(isMac
      ? { trafficLightPosition: { x: 18, y: 18 } }
      : {
          titleBarOverlay: {
            color: '#00000000',
            symbolColor: s.theme === 'pearl' ? '#2a2540' : '#e9e6ff',
            height: 52
          }
        }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      spellcheck: false
    }
  })
  win.once('ready-to-show', () => win?.show())
  win.webContents.on('did-finish-load', () => {
    for (const l of pendingLinks.splice(0)) send('incoming', l)
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('close', (e) => {
    if (!quitting && settings.get().closeToTray && tray) {
      e.preventDefault()
      win?.hide()
    }
  })
  win.on('closed', () => (win = null))
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL)
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

function buildTray(): void {
  const lang = settings.get().language
  if (!tray) {
    const img = nativeImage.createFromPath(resource(isMac ? 'trayTemplate.png' : 'tray.png'))
    if (isMac) img.setTemplateImage(true)
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img)
    tray.setToolTip('Sabiload')
    tray.on('click', showWindow)
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: tr(lang, 'show'), click: showWindow },
      {
        label: tr(lang, 'newDownload'),
        click: () => {
          showWindow()
          send('incoming', { url: '', source: 'cli' })
        }
      },
      { type: 'separator' },
      { label: tr(lang, 'pauseAll'), click: () => void manager.bulk(manager.list().map((i) => i.id), 'pause') },
      { label: tr(lang, 'resumeAll'), click: () => void manager.bulk(manager.list().map((i) => i.id), 'resume') },
      { type: 'separator' },
      {
        label: tr(lang, 'quit'),
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
}

async function syncBridge(s: Settings): Promise<void> {
  if (bridge) {
    bridge.close()
    bridge = null
  }
  if (s.bridgeEnabled)
    bridge = await startBridge({ port: s.bridgePort, version: app.getVersion(), onLink: deliver })
}

let clipTimer: NodeJS.Timeout | null = null
let lastClip = ''
const FILE_LINK =
  /^https?:\/\/\S+\.(zip|rar|7z|tar|gz|tgz|xz|iso|exe|msi|dmg|pkg|deb|rpm|appimage|apk|mp4|mkv|avi|mov|webm|mp3|flac|wav|m4a|pdf|epub|bin|img)(\?\S*)?$/i
function syncClipboard(s: Settings): void {
  if (clipTimer) clearInterval(clipTimer)
  clipTimer = null
  if (!s.clipboardWatch) return
  const read = async (): Promise<string> => String(await clipboard.readText()).trim()
  void read().then((t) => (lastClip = t))
  clipTimer = setInterval(async () => {
    const text = await read()
    if (text === lastClip) return
    lastClip = text
    if (FILE_LINK.test(text)) deliver({ url: text, source: 'clipboard' })
  }, 1200)
}

function syncPower(): void {
  const busy = manager.activeCount() > 0 && settings.get().preventSleep
  if (busy && sleepBlock === null) sleepBlock = powerSaveBlocker.start('prevent-app-suspension')
  if (!busy && sleepBlock !== null) {
    powerSaveBlocker.stop(sleepBlock)
    sleepBlock = null
  }
}

function notify(titleKey: 'done' | 'failed', body: string, filePath?: string): void {
  if (!settings.get().notifications || !Notification.isSupported()) return
  const n = new Notification({ title: tr(settings.get().language, titleKey), body, icon: resource('icon.png') })
  n.on('click', () => {
    if (filePath) shell.showItemInFolder(filePath)
    else showWindow()
  })
  n.show()
}

function registerIpc(): void {
  const handle = (name: string, fn: (...args: never[]) => unknown): void => {
    ipcMain.handle(`sabi:${name}`, (_e, ...args) => fn(...(args as never[])))
  }
  handle('getInfo', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    bindingOk,
    electron: process.versions.electron
  }))
  handle('getSettings', () => settings.get())
  handle('setSettings', (patch: Partial<Settings>) => settings.set(patch))
  handle('listNetworks', () => nets.networks())
  handle('refreshNetworks', () => nets.refresh())
  handle('listDownloads', () => manager.list())
  handle('getDetail', (id: string) => manager.detail(id))
  handle('probe', (url: string, headers?: Record<string, string>) => manager.probeUrl(url, headers))
  handle('add', (req: NewDownloadRequest) => manager.add(req))
  handle('action', (id: string, action: Parameters<DownloadManager['action']>[1]) => manager.action(id, action))
  handle('bulk', (ids: string[], action: Parameters<DownloadManager['action']>[1]) => manager.bulk(ids, action))
  handle('replaceUrl', (id: string, url: string) => manager.replaceUrl(id, url))
  handle('chooseFolder', async (current?: string) => {
    const r = await dialog.showOpenDialog(win!, {
      defaultPath: current || settings.get().downloadDir,
      properties: ['openDirectory', 'createDirectory']
    })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('openExternal', (url: string) => {
    if (/^(https?|mailto|tg):/.test(url)) return shell.openExternal(url)
    return undefined
  })
  handle('diskFree', async (dir?: string) => {
    try {
      const s = await statfs(dir || settings.get().downloadDir)
      return s.bavail * s.bsize
    } catch {
      return null
    }
  })
  handle('checkUpdate', () => updater.check())
  handle('installUpdate', () => updater.install())
  handle('readClipboard', async () => String(await clipboard.readText()))
  ipcMain.on('sabi:setTitleBar', (_e, color: string, symbolColor: string) => {
    if (!isMac && win && !win.isDestroyed()) {
      try {
        win.setTitleBarOverlay({ color, symbolColor, height: 52 })
      } catch {
        /* not supported on this platform */
      }
    }
  })
}

function linkFromArgv(argv: string[]): string | null {
  const hit = argv.find((a) => /^https?:\/\//i.test(a) || a.startsWith('sabiload://'))
  if (!hit) return null
  return hit.startsWith('sabiload://') ? decodeURIComponent(hit.replace(/^sabiload:\/\/(add\/?\?url=)?/, '')) : hit
}

app.on('second-instance', (_e, argv) => {
  const url = linkFromArgv(argv)
  if (url) deliver({ url, source: 'cli' })
  else showWindow()
})

app.on('open-url', (e, url) => {
  e.preventDefault()
  const link = linkFromArgv([url])
  if (link) deliver({ url: link, source: 'cli' })
})

app.whenReady().then(async () => {
  if (!isMac) Menu.setApplicationMenu(null)
  app.setAsDefaultProtocolClient('sabiload')
  const s = await settings.load()
  nativeTheme.themeSource = s.theme === 'pearl' ? 'light' : 'dark'
  bindingOk = await initDeviceBinding()
  nets = new NetworkService(() => settings.get(), path.join(app.getPath('userData'), 'usage.json'))
  manager = new DownloadManager(path.join(app.getPath('userData'), 'downloads.json'), nets, {
    settings: () => settings.get(),
    openPath: async (p) => {
      await shell.openPath(p)
    },
    showInFolder: (p) => shell.showItemInFolder(p),
    trash: (p) => shell.trashItem(p)
  })
  updater = new Updater((u) => send('update', u))
  registerIpc()
  await nets.start()
  await manager.load()

  let netTimer: NodeJS.Timeout | null = null
  nets.on('change', () => {
    if (netTimer) return
    netTimer = setTimeout(() => {
      netTimer = null
      send('networks', nets.networks())
    }, 400)
  })
  manager.on('changed', (items) => {
    send('downloads', items)
    syncPower()
    if (tray) {
      const speed = manager.totalSpeed()
      tray.setToolTip(speed > 0 ? `Sabiload — ${(speed / 1048576).toFixed(1)} MB/s` : 'Sabiload')
    }
  })
  manager.on('removed', (ids) => send('removed', ids))
  manager.on('completed', (item) => notify('done', item.fileName, item.filePath))
  manager.on('failed', (item) => notify('failed', item.fileName))
  settings.on('change', (value: Settings, patch: Partial<Settings>) => {
    send('settings', value)
    manager.onSettingsChanged(patch)
    if ('bridgeEnabled' in patch || 'bridgePort' in patch) void syncBridge(value)
    if ('clipboardWatch' in patch) syncClipboard(value)
    if ('language' in patch) buildTray()
    if ('theme' in patch) nativeTheme.themeSource = value.theme === 'pearl' ? 'light' : 'dark'
    if ('netNames' in patch || 'netColors' in patch || 'netLimits' in patch) {
      nets.rebuild()
      send('networks', nets.networks())
    }
  })

  createWindow()
  buildTray()
  await syncBridge(s)
  syncClipboard(s)
  const startLink = linkFromArgv(process.argv)
  if (startLink) deliver({ url: startLink, source: 'cli' })
  if (s.autoUpdate) setTimeout(() => void updater.check(), 8000)

  app.on('activate', showWindow)
})

app.on('before-quit', (e) => {
  if (quitting === true && (app as unknown as { _sabiDone?: boolean })._sabiDone) return
  quitting = true
  if (!manager) return
  e.preventDefault()
  void Promise.allSettled([manager.shutdown(), nets.stop()]).then(() => {
    ;(app as unknown as { _sabiDone?: boolean })._sabiDone = true
    bridge?.close()
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (!isMac && !(settings.get()?.closeToTray && tray)) app.quit()
})

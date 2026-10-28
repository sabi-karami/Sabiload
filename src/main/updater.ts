import { app, shell } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateState } from '../shared/types'

const { autoUpdater } = electronUpdater
const RELEASES = 'https://github.com/sabi-karami/Sabiload/releases/latest'

/** Unsigned macOS builds cannot replace themselves, so there we only point to the release. */
const canInstall = (): boolean => process.platform !== 'darwin' && app.isPackaged

export class Updater {
  state: UpdateState = { state: 'idle' }

  constructor(private emit: (s: UpdateState) => void) {
    autoUpdater.autoDownload = canInstall()
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }))
    autoUpdater.on('update-available', (i) =>
      this.set({ state: canInstall() ? 'downloading' : 'available', version: i.version, percent: 0 })
    )
    autoUpdater.on('update-not-available', () => this.set({ state: 'none' }))
    autoUpdater.on('download-progress', (p) =>
      this.set({ ...this.state, state: 'downloading', percent: Math.round(p.percent) })
    )
    autoUpdater.on('update-downloaded', (i) => this.set({ state: 'ready', version: i.version }))
    autoUpdater.on('error', (e) => this.set({ state: 'error', error: String(e?.message ?? e) }))
  }

  private set(s: UpdateState): void {
    this.state = s
    this.emit(s)
  }

  async check(): Promise<void> {
    if (!app.isPackaged) {
      this.set({ state: 'none' })
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      this.set({ state: 'error', error: String((e as Error).message) })
    }
  }

  async install(): Promise<void> {
    if (this.state.state === 'ready') autoUpdater.quitAndInstall(false, true)
    else await shell.openExternal(RELEASES)
  }
}

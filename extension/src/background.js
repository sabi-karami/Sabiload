import { getSettings, hostOf, sendToApp } from './shared.js'

const api = globalThis.browser ?? chrome
/** Downloads we cancelled and handed over, so the browser doesn't show them as failures. */
const handed = new Set()

function setBadge(on) {
  const suffix = on ? '' : '-off'
  api.action.setIcon({ path: { 16: `icons/icon${suffix}-16.png`, 32: `icons/icon${suffix}-32.png` } })
}

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({ id: 'sabiload-link', title: 'Download with Sabiload', contexts: ['link', 'video', 'audio', 'image'] })
  api.contextMenus.create({ id: 'sabiload-page', title: 'Download this page with Sabiload', contexts: ['page'] })
})

api.storage.onChanged.addListener(async () => setBadge((await getSettings()).enabled))
getSettings().then((s) => setBadge(s.enabled))

api.contextMenus.onClicked.addListener(async (info, tab) => {
  const s = await getSettings()
  const url = info.linkUrl || info.srcUrl || info.pageUrl
  if (!url || !/^https?:/.test(url)) return
  try {
    await sendToApp(s.port, { url, referrer: tab?.url })
  } catch {
    /* app not running: nothing to do */
  }
})

api.downloads.onCreated.addListener(async (item) => {
  const s = await getSettings()
  if (!s.enabled) return
  const url = item.finalUrl || item.url
  if (!/^https?:/.test(url)) return
  if (item.byExtensionId === api.runtime.id) return
  const host = hostOf(url)
  if (s.excluded.some((h) => host === h || host.endsWith(`.${h}`))) return
  if (item.fileSize > 0 && item.fileSize < s.minSizeMB * 1048576) return
  if (item.totalBytes > 0 && item.totalBytes < s.minSizeMB * 1048576) return
  try {
    const ok = await sendToApp(s.port, {
      url,
      fileName: item.filename ? item.filename.split(/[\\/]/).pop() : undefined,
      size: item.totalBytes > 0 ? item.totalBytes : undefined,
      referrer: item.referrer
    })
    if (!ok) return
    handed.add(item.id)
    await api.downloads.cancel(item.id)
    await api.downloads.erase({ id: item.id })
  } catch {
    /* Sabiload isn't running: let the browser download it. */
  }
})

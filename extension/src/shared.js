// Settings and the call into the desktop app, shared by the worker, popup and options page.
export const DEFAULTS = { enabled: true, port: 17345, minSizeMB: 1, excluded: [] }

export async function getSettings() {
  const saved = await chrome.storage.sync.get(DEFAULTS)
  return { ...DEFAULTS, ...saved }
}

export async function ping(port) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/ping`, { headers: { 'x-sabiload': '1' } })
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

async function cookiesFor(url) {
  try {
    const list = await chrome.cookies.getAll({ url })
    return list.map((c) => `${c.name}=${c.value}`).join('; ')
  } catch {
    return ''
  }
}

export async function sendToApp(port, { url, fileName, size, referrer }) {
  const body = {
    url,
    fileName,
    size,
    referrer,
    cookies: await cookiesFor(url),
    userAgent: navigator.userAgent
  }
  const r = await fetch(`http://127.0.0.1:${port}/add`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-sabiload': '1' },
    body: JSON.stringify(body)
  })
  return r.ok
}

export function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

import { getSettings, hostOf, ping } from './shared.js'

const api = globalThis.browser ?? chrome
const $ = (id) => document.getElementById(id)

async function main() {
  const s = await getSettings()
  const [tab] = await api.tabs.query({ active: true, currentWindow: true })
  const host = hostOf(tab?.url ?? '')
  $('enabled').checked = s.enabled
  $('skip').checked = host ? s.excluded.includes(host) : false
  $('skip').disabled = !host
  const app = await ping(s.port)
  $('state').textContent = app ? `Connected · v${app.version} · متصل` : 'Sabiload is not running · برنامه باز نیست'
  $('state').className = app ? 'ok' : 'bad'
  $('enabled').onchange = (e) => api.storage.sync.set({ enabled: e.target.checked })
  $('skip').onchange = async (e) => {
    const cur = await getSettings()
    const excluded = e.target.checked ? [...new Set([...cur.excluded, host])] : cur.excluded.filter((h) => h !== host)
    await api.storage.sync.set({ excluded })
  }
  $('options').onclick = (e) => {
    e.preventDefault()
    api.runtime.openOptionsPage()
  }
}
main()

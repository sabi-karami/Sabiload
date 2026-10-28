import { getSettings } from './shared.js'

const api = globalThis.browser ?? chrome
const $ = (id) => document.getElementById(id)

getSettings().then((s) => {
  $('min').value = s.minSizeMB
  $('excluded').value = s.excluded.join('\n')
  $('port').value = s.port
})

$('save').onclick = async () => {
  await api.storage.sync.set({
    minSizeMB: Math.max(0, Number($('min').value) || 0),
    excluded: $('excluded').value.split('\n').map((x) => x.trim()).filter(Boolean),
    port: Number($('port').value) || 17345
  })
  $('saved').hidden = false
  setTimeout(() => ($('saved').hidden = true), 1500)
}

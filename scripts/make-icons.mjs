// Renders the Sabiload mark to every PNG the app, installers, tray and extension need.
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const tile = (c1 = '#7c3aed', c2 = '#6366f1', c3 = '#22d3ee', shade = true) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/>
    </linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="h" cx="0.3" cy="0.2" r="0.8">
      <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <filter id="d" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="28" stdDeviation="30" flood-color="#2e1065" flood-opacity="0.55"/>
    </filter>
    <filter id="w" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#1e1b4b" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g filter="${shade ? 'url(#d)' : ''}">
    <rect x="92" y="80" width="840" height="840" rx="230" fill="url(#g)"/>
  </g>
  <rect x="92" y="80" width="840" height="840" rx="230" fill="url(#h)"/>
  <rect x="92" y="80" width="840" height="420" rx="230" fill="url(#s)"/>
  <rect x="96" y="84" width="832" height="832" rx="226" fill="none" stroke="#fff" stroke-opacity="0.25" stroke-width="8"/>
  <g filter="url(#w)" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="64">
    <path d="M320 256 C320 448 512 416 512 576" stroke-opacity="0.72"/>
    <path d="M704 256 C704 448 512 416 512 576" stroke-opacity="0.72"/>
    <path d="M512 224 V608"/>
    <path d="M368 528 L512 688 L656 528"/>
  </g>
  <rect x="320" y="752" width="384" height="64" rx="32" fill="#fff"/>
</svg>`

const tray = (fill) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="none" stroke="${fill}" stroke-linecap="round" stroke-linejoin="round" stroke-width="6">
    <path d="M18 10 C18 26 32 24 32 36" opacity="0.7"/><path d="M46 10 C46 26 32 24 32 36" opacity="0.7"/>
    <path d="M32 8 V40"/><path d="M21 31 L32 43 L43 31"/>
  </g>
  <rect x="18" y="50" width="28" height="6" rx="3" fill="${fill}"/>
</svg>`

const render = (svg, size, file) => {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(file, png)
}

for (const d of ['build', 'resources', 'extension/icons', 'docs/assets']) mkdirSync(d, { recursive: true })
render(tile(), 1024, 'build/icon.png')
render(tile(), 512, 'resources/icon.png')
render(tile(), 256, 'docs/assets/icon-256.png')
render(tile(), 512, 'docs/assets/icon-512.png')
render(tile(), 64, 'docs/assets/favicon.png')
render(tray('#ffffff'), 32, 'resources/tray.png')
render(tray('#000000'), 22, 'resources/trayTemplate.png')
render(tray('#000000'), 44, 'resources/trayTemplate@2x.png')
for (const s of [16, 32, 48, 128]) {
  render(tile(), s, `extension/icons/icon-${s}.png`)
  render(tile('#6b7280', '#4b5563', '#9ca3af', false), s, `extension/icons/icon-off-${s}.png`)
}
writeFileSync('docs/assets/logo.svg', tile())
console.log('icons ready')

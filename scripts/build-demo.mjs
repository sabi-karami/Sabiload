// Copies the built interface (out/renderer) into docs/demo with the simulated backend in front.
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const out = 'docs/demo'
rmSync(out, { recursive: true, force: true })
cpSync('out/renderer', out, { recursive: true })
cpSync('scripts/demo/mock.js', `${out}/mock.js`)
let html = readFileSync(`${out}/index.html`, 'utf8')
html = html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, '')
html = html.replace('<head>', '<head>\n    <script src="./mock.js"></script>\n    <link rel="icon" href="../assets/favicon.png" />')
html = html.replace(/(src|href)="\/assets\//g, '$1="./assets/')
writeFileSync(`${out}/index.html`, html)
console.log('demo ready in', out)

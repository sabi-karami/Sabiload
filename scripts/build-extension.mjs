// Bundles the extension into extension/dist/{chrome,firefox} and zips both for the release.
import { build } from 'vite'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = path.resolve('extension')
const dist = path.join(root, 'dist')
rmSync(dist, { recursive: true, force: true })
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

for (const entry of ['background', 'popup', 'options']) {
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir: path.join(dist, 'common'),
      emptyOutDir: false,
      minify: true,
      lib: { entry: path.join(root, 'src', `${entry}.js`), formats: ['es'], fileName: () => `${entry}.js` }
    }
  })
}

for (const target of ['chrome', 'firefox']) {
  const out = path.join(dist, target)
  mkdirSync(out, { recursive: true })
  cpSync(path.join(dist, 'common'), out, { recursive: true })
  cpSync(path.join(root, 'icons'), path.join(out, 'icons'), { recursive: true })
  for (const f of ['popup.html', 'options.html', 'ui.css']) cpSync(path.join(root, 'src', f), path.join(out, f))
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'))
  manifest.version = pkg.version.replace(/-.*$/, '')
  if (target === 'chrome') {
    delete manifest.browser_specific_settings
    delete manifest.background.scripts
    manifest.background.type = 'module'
  } else {
    delete manifest.background.service_worker
    manifest.background.type = 'module'
  }
  writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
  try {
    execFileSync('zip', ['-qr', path.join(dist, `sabiload-extension-${target}-${pkg.version}.zip`), '.'], { cwd: out })
  } catch {
    console.warn('zip not available, skipped archive for', target)
  }
}
rmSync(path.join(dist, 'common'), { recursive: true, force: true })
console.log('extension built in', dist)

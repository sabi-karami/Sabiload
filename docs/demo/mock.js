/*
 * A fake desktop backend so the real Sabiload interface can run in a plain browser — this powers
 * the live demo on the website. Everything is simulated: networks, speeds and downloads.
 */
;(() => {
  const q = new URLSearchParams(location.search)
  const saved = JSON.parse(localStorage.getItem('sabi-demo') || '{}')
  const listeners = {}
  const emit = (ev, payload) => (listeners[ev] || []).forEach((cb) => cb(payload))
  const MB = 1048576
  const GB = 1024 * MB

  const settings = {
    language: q.get('lang') || saved.language || (navigator.language.startsWith('fa') ? 'fa' : 'en'),
    theme: q.get('theme') || saved.theme || 'nebula',
    downloadDir: '/Users/you/Downloads',
    maxConcurrent: 3,
    streamsMode: 'auto',
    globalLimit: 0,
    slowMode: false,
    slowLimit: 512 * 1024,
    speedUnit: 'bytes',
    netNames: {},
    netColors: {},
    netLimits: {},
    netDailyCaps: {},
    netMonthlyCaps: {},
    disabledNets: [],
    schedule: { enabled: false, start: '01:00', end: '07:00', days: [0, 1, 2, 3, 4, 5, 6] },
    bridgeEnabled: true,
    bridgePort: 17345,
    askBeforeBridge: true,
    clipboardWatch: false,
    notifications: true,
    autoUpdate: true,
    closeToTray: false,
    preventSleep: true,
    categorizeFolders: false,
    onboarded: q.get('onboard') === '1' ? false : true
  }

  const baseNets = [
    { id: 'en0', device: 'en0', name: 'Wi-Fi · Home', hardware: 'Wi-Fi', kind: 'wifi', color: '#8b5cf6', cap: 7.6 * MB, latency: 18, addr: '192.168.1.24' },
    { id: 'en7', device: 'en7', name: 'iPhone USB', hardware: 'iPhone USB', kind: 'usb', color: '#22d3ee', cap: 5.1 * MB, latency: 41, addr: '172.20.10.2' },
    { id: 'en5', device: 'en5', name: 'Ethernet · 5G modem', hardware: 'USB 10/100/1000 LAN', kind: 'ethernet', color: '#f43f5e', cap: 4.2 * MB, latency: 27, addr: '10.42.0.11' }
  ]
  const usage = { en0: 3.2 * GB, en7: 1.4 * GB, en5: 0.9 * GB }
  const netSpeed = {}

  const networks = () =>
    baseNets.map((n) => ({
      id: n.id,
      device: n.device,
      name: settings.netNames[n.id] || n.name,
      hardware: n.hardware,
      kind: n.kind,
      addresses: [{ address: n.addr, family: 4 }],
      color: settings.netColors[n.id] || n.color,
      enabled: !settings.disabledNets.includes(n.id),
      latency: n.latency + Math.round(Math.random() * 6),
      online: true,
      limit: settings.netLimits[n.id] || 0,
      dailyCap: settings.netDailyCaps[n.id] || 0,
      monthlyCap: settings.netMonthlyCaps[n.id] || 0,
      usage: { today: usage[n.id], month: usage[n.id] * 6.3 },
      capped: false,
      speed: Math.round(netSpeed[n.id] || 0)
    }))

  let seq = 1
  const mk = (fileName, size, category, status, frac, extra = {}) => ({
    id: `d${seq++}`,
    url: `https://cdn.example.org/files/${encodeURIComponent(fileName)}`,
    fileName,
    dir: settings.downloadDir,
    size,
    received: Math.round(size * frac),
    status,
    resumable: true,
    createdAt: Date.now() - seq * 600000,
    category,
    networks: null,
    streamsMode: 'auto',
    speed: 0,
    peak: status === 'completed' ? 16.4 * MB : 0,
    eta: null,
    activeMs: Math.max(4000, ((size * frac) / (5.2 * MB)) * 1000),
    nets:
      frac > 0
        ? { en0: { bytes: size * frac * 0.45, speed: 0, streams: 0 }, en7: { bytes: size * frac * 0.31, speed: 0, streams: 0 }, en5: { bytes: size * frac * 0.24, speed: 0, streams: 0 } }
        : {},
    probed: true,
    filePath: `${settings.downloadDir}/${fileName}`,
    ...extra
  })

  const downloads = [
    mk('ubuntu-24.04.1-desktop-amd64.iso', 5.8 * GB, 'archive', 'downloading', 0.42),
    mk('Interstellar.2014.2160p.UHD.mkv', 21.3 * GB, 'video', 'downloading', 0.17),
    mk('Blender-4.3.0-windows-x64.msi', 368 * MB, 'program', 'downloading', 0.71),
    mk('Clean Code — Robert C. Martin.pdf', 9.4 * MB, 'document', 'completed', 1),
    mk('Hans Zimmer — Time (Live).flac', 112 * MB, 'audio', 'completed', 1),
    mk('android-studio-2025.1-mac_arm.dmg', 1.3 * GB, 'program', 'queued', 0),
    mk('dataset-satellite-tiles.tar.zst', 3.4 * GB, 'archive', 'paused', 0.36),
    mk('wallpaper-pack-8k.zip', 640 * MB, 'image', 'error', 0.12, { error: 'http_403' })
  ]
  const history = {}
  const order = () => downloads

  function tick() {
    const nets = networks().filter((n) => n.enabled)
    const active = downloads.filter((d) => d.status === 'downloading')
    for (const k of Object.keys(netSpeed)) netSpeed[k] = 0
    const limitFactor = settings.slowMode ? Math.min(1, settings.slowLimit / (17 * MB)) : 1
    const changed = []
    for (const d of active) {
      let total = 0
      const share = 1 / active.length
      for (const n of nets) {
        const base = baseNets.find((b) => b.id === n.id).cap
        const wobble = 0.75 + Math.random() * 0.5
        const v = base * share * wobble * limitFactor
        const prev = d.nets[n.id] || { bytes: 0, speed: 0, streams: 0 }
        const bytes = v * 0.3
        d.nets[n.id] = { bytes: prev.bytes + bytes, speed: prev.speed ? prev.speed * 0.6 + v * 0.4 : v, streams: 8 + Math.round(Math.random() * 6) }
        total += d.nets[n.id].speed
        netSpeed[n.id] = (netSpeed[n.id] || 0) + d.nets[n.id].speed
        d.received += bytes
      }
      for (const id of Object.keys(d.nets)) if (!nets.some((n) => n.id === id)) d.nets[id] = { ...d.nets[id], speed: 0, streams: 0 }
      d.speed = total
      d.peak = Math.max(d.peak, total)
      d.activeMs += 300
      d.eta = total ? (d.size - d.received) / total : null
      if (d.received >= d.size) {
        d.received = d.size
        d.status = 'completed'
        d.speed = 0
        d.eta = null
        for (const id of Object.keys(d.nets)) d.nets[id] = { ...d.nets[id], speed: 0, streams: 0 }
        const next = downloads.find((x) => x.status === 'queued')
        if (next) next.status = 'downloading'
      }
      const h = (history[d.id] = history[d.id] || [])
      h.push({ t: Date.now(), total: d.speed, nets: Object.fromEntries(Object.entries(d.nets).map(([k, v]) => [k, v.speed])) })
      if (h.length > 400) h.shift()
      changed.push(d)
    }
    if (changed.length) emit('downloads', changed.map((d) => ({ ...d, nets: { ...d.nets } })))
  }
  setInterval(tick, 300)
  setInterval(() => emit('networks', networks()), 1000)

  const segmentsFor = (d) => {
    const segs = []
    const pieces = 64
    const per = d.size / pieces
    const done = d.received / d.size
    const ids = Object.keys(d.nets)
    for (let i = 0; i < pieces; i++) {
      const s = i * per
      const filled = (i * 0.618) % 1 < done ? 1 : 0
      const n = ids.length ? ids[(i * 7) % ids.length] : null
      const active = d.status === 'downloading' && !filled && i % 9 === 0
      if (filled) segs.push({ s, e: s + per, p: s + per, n, active: false })
      else if (active) segs.push({ s, e: s + per, p: s + per * Math.random(), n, active: true })
    }
    return segs
  }

  const ok = (v) => Promise.resolve(JSON.parse(JSON.stringify(v ?? null)))
  window.sabi = {
    getInfo: () => ok({ version: '1.0.0', platform: 'web-demo', arch: 'wasm', bindingOk: true, electron: '—' }),
    getSettings: () => ok(settings),
    setSettings: (p) => {
      Object.assign(settings, p)
      localStorage.setItem('sabi-demo', JSON.stringify({ language: settings.language, theme: settings.theme }))
      emit('settings', { ...settings })
      setTimeout(() => emit('networks', networks()), 0)
      return ok(settings)
    },
    listNetworks: () => ok(networks()),
    refreshNetworks: () => ok(networks()),
    listDownloads: () => ok(order()),
    getDetail: (id) => {
      const d = downloads.find((x) => x.id === id)
      return ok(d ? { id, size: d.size, segments: segmentsFor(d), history: (history[id] || []).filter((_, i, a) => i % 3 === 0 || i === a.length - 1).slice(-120) } : null)
    },
    probe: (url) => {
      const name = decodeURIComponent(url.split('/').pop().split('?')[0] || 'download.bin')
      return new Promise((r) => setTimeout(() => r({ ok: true, url, finalUrl: url, fileName: name, size: Math.round((0.2 + Math.random() * 4) * GB), resumable: true, contentType: null }), 600))
    },
    add: (req) => {
      const ids = []
      for (const url of req.urls) {
        const name = req.fileName || decodeURIComponent(url.split('/').pop().split('?')[0] || 'download.bin')
        const d = mk(name, Math.round((0.3 + Math.random() * 3) * GB), 'other', req.start ? 'downloading' : 'queued', 0)
        d.url = url
        downloads.unshift(d)
        ids.push(d.id)
      }
      emit('downloads', downloads.filter((d) => ids.includes(d.id)))
      return ok(ids)
    },
    action: (id, a) => {
      const d = downloads.find((x) => x.id === id)
      if (!d) return ok()
      if (a === 'pause') d.status = 'paused'
      if (a === 'resume' || a === 'retry') (d.status = 'downloading'), (d.error = undefined)
      if (a === 'restart') Object.assign(d, { received: 0, status: 'downloading', nets: {} })
      if (['remove', 'cancel', 'removeWithFile'].includes(a)) {
        downloads.splice(downloads.indexOf(d), 1)
        emit('removed', [id])
        return ok()
      }
      d.speed = 0
      for (const k of Object.keys(d.nets)) d.nets[k].speed = 0
      emit('downloads', [d])
      return ok()
    },
    bulk: (ids, a) => Promise.all(ids.map((id) => window.sabi.action(id, a))),
    replaceUrl: () => ok({ ok: true }),
    chooseFolder: () => ok(null),
    openExternal: (u) => (window.open(u, '_blank'), ok()),
    diskFree: () => ok(412 * GB),
    checkUpdate: () => (emit('update', { state: 'none' }), ok()),
    installUpdate: () => ok(),
    setTitleBar: () => undefined,
    readClipboard: () => ok(''),
    on: (ev, cb) => {
      ;(listeners[ev] = listeners[ev] || []).push(cb)
      return () => (listeners[ev] = listeners[ev].filter((x) => x !== cb))
    }
  }

  // Deep links used for screenshots: ?view=networks  ?detail=1
  window.addEventListener('load', () => {
    setTimeout(() => {
      const store = window.__sabiStore
      if (!store) return
      if (q.get('view')) store.getState().setView(q.get('view'))
      if (q.get('detail')) store.getState().openDetail(downloads[Number(q.get('detail')) - 1]?.id ?? null)
      if (q.get('dialog')) store.getState().openDialog({ url: 'https://releases.example.com/sabiload/big-file-4k.mkv', source: 'cli' })
    }, 300)
  })
})()

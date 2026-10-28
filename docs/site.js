// Language switcher, 3D tilt, counters, feature cards and the starfield.
const FEATURES = [
  ['🛰️', '#8b5cf6', 'ترکیب همهٔ شبکه‌ها', 'Combine every network', 'وای‌فای، اترنت، اینترنت همراه، USB و حتی VPN — همه با هم برای یک فایل.', 'Wi-Fi, Ethernet, mobile data, USB tethering and even VPNs — all on one file.'],
  ['⚡', '#22d3ee', 'جریان‌های خودتنظیم', 'Self-tuning streams', 'تا ۳۲ اتصال برای هر شبکه؛ تا وقتی سرعت بالا برود زیاد و با فشار سرور کم می‌شود.', 'Up to 32 connections per network — added while they help, removed when servers push back.'],
  ['🏁', '#f43f5e', 'پایان بدون معطلی', 'No slow finish', 'اتصال‌های آزاد کار تکه‌های کند را می‌دزدند تا ۹۹٪ هرگز گیر نکند.', 'Idle connections steal work from slow pieces, so you never get stuck at 99%.'],
  ['🔁', '#10b981', 'ادامهٔ ضدضربه', 'Bullet-proof resume', 'پس از قطعی اینترنت، خواب کامپیوتر یا بستن برنامه دقیقاً از همان‌جا ادامه می‌دهد.', 'Picks up exactly where it stopped after drops, sleep or restarts.'],
  ['🔗', '#f59e0b', 'تعویض لینک منقضی', 'Swap expired links', 'لینک تازه را بچسبانید و دانلود بدون از دست رفتن حتی یک بایت ادامه پیدا کند.', 'Paste a fresh link and continue without losing a single byte.'],
  ['🔀', '#3b82f6', 'شبکه‌ها حین دانلود', 'Hot-swap networks', 'شبکه‌ای را وسط دانلود روشن یا خاموش کنید؛ کار بی‌وقفه منتقل می‌شود.', 'Turn networks on or off mid-download; work moves over seamlessly.'],
  ['📅', '#ec4899', 'زمان‌بندی هوشمند', 'Smart scheduler', 'دانلود فقط در ساعت‌های شب یا روزهای دلخواه — حتی بازه‌های بعد از نیمه‌شب.', 'Download only at night or on chosen days — overnight windows included.'],
  ['📊', '#84cc16', 'سقف مصرف هر شبکه', 'Data allowances', 'سقف روزانه و ماهانه برای اینترنت گوشی، به‌همراه محدودیت سرعت جداگانه.', 'Daily and monthly caps for mobile data, plus per-network speed limits.'],
  ['🐢', '#a78bfa', 'حالت آرام', 'Slow mode', 'یک کلیک تا تماس تصویری و بازی آنلاین روان بمانند.', 'One click keeps video calls and games smooth.'],
  ['🧩', '#06b6d4', 'افزونهٔ مرورگر', 'Browser extension', 'دانلودهای کروم، اج و فایرفاکس را با کوکی‌های همان سایت تحویل می‌گیرد.', 'Catches Chrome, Edge and Firefox downloads with the site’s own login.'],
  ['🗺️', '#f97316', 'نقشهٔ زندهٔ تکه‌ها', 'Live block map', 'ببینید هر تکه از فایل را کدام شبکه و با چه سرعتی گرفته است.', 'Watch which network fetched each piece of the file, live.'],
  ['🎨', '#d946ef', '۴ پوستهٔ سه‌بعدی', '4 gorgeous 3D themes', 'سحابی، شفق، سلطنتی و مروارید — با رابط کاملاً فارسی و راست‌به‌چپ.', 'Nebula, Aurora, Royal and Pearl — with full Persian RTL support.']
]

let lang = localStorage.getItem('sabi-site-lang') || (navigator.language.startsWith('fa') ? 'fa' : 'en')

function renderFeatures() {
  const grid = document.getElementById('feature-grid')
  grid.innerHTML = FEATURES.map(
    ([ico, c, tfa, ten, dfa, den]) =>
      `<div class="feat reveal tilt" style="--c:${c}"><div class="ico">${ico}</div><h3>${lang === 'fa' ? tfa : ten}</h3><p>${lang === 'fa' ? dfa : den}</p></div>`
  ).join('')
  observe()
  bindTilt()
}

function applyLang() {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr'
  document.querySelectorAll('[data-fa]').forEach((el) => (el.textContent = el.dataset[lang]))
  document.getElementById('lang').textContent = lang === 'fa' ? 'English' : 'فارسی'
  const shot = document.getElementById('shot')
  const on = document.querySelector('.theme-switch .on')
  if (on?.dataset.shot === 'main-fa' || on?.dataset.shot === 'main-en-aurora') {
    /* keep the chosen theme */
  }
  shot.alt = lang === 'fa' ? 'تصویر صبی‌لود' : 'Sabiload screenshot'
  detectOS()
  renderFeatures()
}

document.getElementById('lang').onclick = () => {
  lang = lang === 'fa' ? 'en' : 'fa'
  localStorage.setItem('sabi-site-lang', lang)
  applyLang()
}

function detectOS() {
  const ua = navigator.userAgent
  const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Linux|X11/.test(ua) ? 'Linux' : ''
  const label = document.getElementById('os-label')
  label.textContent = os ? (lang === 'fa' ? `برای ${os}` : `for ${os}`) : ''
}

document.querySelectorAll('.theme-switch button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.theme-switch button').forEach((x) => x.classList.remove('on'))
    b.classList.add('on')
    const img = document.getElementById('shot')
    img.style.opacity = 0
    setTimeout(() => {
      img.src = `screenshots/${b.dataset.shot}.png`
      img.onload = () => (img.style.opacity = 1)
    }, 200)
  }
})

let io
function observe() {
  io ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('in')
        if (e.target.classList.contains('count')) countUp(e.target)
      }),
    { threshold: 0.2 }
  )
  document.querySelectorAll('.reveal:not(.in), .frame, .count, .step, .plat').forEach((el) => {
    if (!el.classList.contains('frame') && !el.classList.contains('count')) el.classList.add('reveal')
    io.observe(el)
  })
}

function countUp(el) {
  if (el.dataset.done) return
  el.dataset.done = 1
  const to = Number(el.dataset.to)
  const t0 = performance.now()
  const step = (t) => {
    const p = Math.min(1, (t - t0) / 1200)
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)))
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function bindTilt() {
  document.querySelectorAll('.tilt').forEach((el) => {
    if (el.dataset.tilt) return
    el.dataset.tilt = 1
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)`
    })
    el.addEventListener('mouseleave', () => (el.style.transform = ''))
  })
}

// 3D scene follows the mouse
const scene = document.querySelector('.scene')
window.addEventListener('mousemove', (e) => {
  const x = e.clientX / innerWidth - 0.5
  const y = e.clientY / innerHeight - 0.5
  scene.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`
})

// Starfield with depth
const c = document.getElementById('space')
const ctx = c.getContext('2d')
let stars = []
function resize() {
  c.width = innerWidth * devicePixelRatio
  c.height = innerHeight * devicePixelRatio
  stars = Array.from({ length: 220 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }))
}
function frame() {
  ctx.clearRect(0, 0, c.width, c.height)
  const cx = c.width / 2
  const cy = c.height / 2
  for (const s of stars) {
    s.z -= 0.0016
    if (s.z <= 0.02) s.z = 1
    const k = 0.6 / s.z
    const px = cx + s.x * cx * k
    const py = cy + s.y * cy * k
    if (px < 0 || px > c.width || py < 0 || py > c.height) continue
    const size = (1 - s.z) * 2.2 * devicePixelRatio
    ctx.fillStyle = `rgba(${200 + 55 * (1 - s.z)},${190},255,${1 - s.z})`
    ctx.beginPath()
    ctx.arc(px, py, size, 0, Math.PI * 2)
    ctx.fill()
  }
  requestAnimationFrame(frame)
}
addEventListener('resize', resize)
resize()
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) frame()

applyLang()

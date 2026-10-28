import type { Lang } from '../../shared/types'

const nf = new Map<string, Intl.NumberFormat>()
function fmt(lang: Lang, digits: number): Intl.NumberFormat {
  const key = `${lang}${digits}`
  let f = nf.get(key)
  if (!f) {
    f = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0
    })
    nf.set(key, f)
  }
  return f
}

export const num = (lang: Lang, n: number, digits = 0): string => fmt(lang, digits).format(n)

const UNITS = {
  en: ['B', 'KB', 'MB', 'GB', 'TB'],
  fa: ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت']
}
const BIT_UNITS = {
  en: ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'],
  fa: ['بیت', 'کیلوبیت', 'مگابیت', 'گیگابیت', 'ترابیت']
}

export function bytes(lang: Lang, n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  let i = 0
  let v = n
  while (v >= 1024 && i < 4) {
    v /= 1024
    i++
  }
  return `${num(lang, v, v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${UNITS[lang][i]}`
}

export function speed(lang: Lang, bps: number, unit: 'bytes' | 'bits' = 'bytes'): string {
  if (unit === 'bits') {
    let v = bps * 8
    let i = 0
    while (v >= 1000 && i < 4) {
      v /= 1000
      i++
    }
    return `${num(lang, v, v >= 100 ? 0 : 1)} ${BIT_UNITS[lang][i]}${lang === 'fa' ? ' بر ثانیه' : ''}`
  }
  return `${bytes(lang, bps)}${lang === 'fa' ? '/ث' : '/s'}`
}

/** Split for big hero numbers: value and unit separately. */
export function speedParts(lang: Lang, bps: number, unit: 'bytes' | 'bits' = 'bytes'): [string, string] {
  if (unit === 'bits') {
    const v = (bps * 8) / 1_000_000
    return [num(lang, v, v >= 100 ? 0 : 1), lang === 'fa' ? 'مگابیت/ث' : 'Mbps']
  }
  const v = bps / 1048576
  return [num(lang, v, v >= 100 ? 0 : v >= 10 ? 1 : 2), lang === 'fa' ? 'مگابایت/ث' : 'MB/s']
}

export function duration(lang: Lang, secs: number | null | undefined): string {
  if (secs === null || secs === undefined || !Number.isFinite(secs) || secs < 0) return '—'
  const s = Math.round(secs)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const L = lang === 'fa' ? { h: ' ساعت', m: ' دقیقه', s: ' ثانیه', j: ' و ' } : { h: 'h', m: 'm', s: 's', j: ' ' }
  if (h > 0) return `${num(lang, h)}${L.h}${L.j}${num(lang, m)}${L.m}`
  if (m > 0) return `${num(lang, m)}${L.m}${L.j}${num(lang, r)}${L.s}`
  return `${num(lang, r)}${L.s}`
}

export function percent(lang: Lang, v: number): string {
  return `${num(lang, Math.floor(v * 1000) / 10, 1)}${lang === 'fa' ? '٪' : '%'}`
}

export function timeAgo(lang: Lang, t: number): string {
  const rtf = new Intl.RelativeTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-US', { numeric: 'auto' })
  const d = (t - Date.now()) / 1000
  const abs = Math.abs(d)
  if (abs < 60) return rtf.format(Math.round(d), 'second')
  if (abs < 3600) return rtf.format(Math.round(d / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(d / 3600), 'hour')
  return rtf.format(Math.round(d / 86400), 'day')
}

export const LIMIT_STEPS = [0, 128, 256, 512, 1024, 2048, 5120, 10240, 20480, 51200].map((k) => k * 1024)
export const CAP_STEPS = [0, 0.5, 1, 2, 5, 10, 20, 50, 100].map((g) => Math.round(g * 1024 ** 3))

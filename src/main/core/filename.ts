import { access } from 'node:fs/promises'
import path from 'node:path'

/** Bytes that came in as latin1 but are really UTF-8 (a common server mistake). */
function fixMojibake(s: string): string {
  if (!/[\u0080-\u00ff]/.test(s) || /[^\u0000-\u00ff]/.test(s)) return s
  const bytes = Buffer.from(s, 'latin1')
  const decoded = bytes.toString('utf8')
  return decoded.includes('\ufffd') ? s : decoded
}

/** RFC 2047 encoded words, e.g. =?UTF-8?B?2LPZhNin2YU=?= */
function decodeEncodedWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_m, charset: string, enc: string, text: string) => {
    try {
      const buf =
        enc.toUpperCase() === 'B'
          ? Buffer.from(text, 'base64')
          : Buffer.from(
              text.replace(/_/g, ' ').replace(/=([0-9a-fA-F]{2})/g, (_x, h: string) =>
                String.fromCharCode(Number.parseInt(h, 16))
              ),
              'latin1'
            )
      const cs = charset.toLowerCase()
      return cs === 'utf-8' || cs === 'utf8' ? buf.toString('utf8') : buf.toString('latin1')
    } catch {
      return text
    }
  })
}

function decodeExtValue(v: string): string | null {
  // RFC 5987: charset'lang'percent-encoded
  const m = v.match(/^([\w!#$%&+^`{}~-]*)'[^']*'(.*)$/)
  if (!m) return null
  const raw = m[2]
  try {
    if (m[1].toLowerCase() === 'iso-8859-1') {
      return raw.replace(/%([0-9a-fA-F]{2})/g, (_x, h: string) =>
        String.fromCharCode(Number.parseInt(h, 16))
      )
    }
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

export function parseContentDisposition(header: string | undefined): string | null {
  if (!header) return null
  const params = new Map<string, string>()
  const re = /;\s*([^\s=;]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]*))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(header))) {
    const key = m[1].toLowerCase()
    const val = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : m[3].trim()
    params.set(key, val)
  }
  const ext = params.get('filename*')
  if (ext) {
    const decoded = decodeExtValue(ext)
    if (decoded) return decoded
  }
  const plain = params.get('filename')
  if (!plain) return null
  let name = decodeEncodedWords(plain)
  if (/%[0-9a-fA-F]{2}/.test(name)) {
    try {
      name = decodeURIComponent(name)
    } catch {
      /* keep */
    }
  }
  return fixMojibake(name)
}

export function nameFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    if (!last) return null
    return decodeURIComponent(last)
  } catch {
    return null
  }
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

export function sanitizeFileName(name: string): string {
  let n = name
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  if (!n || n === '.' || n === '..') n = 'download'
  if (RESERVED.test(n)) n = `_${n}`
  if (Buffer.byteLength(n) > 200) {
    const ext = path.extname(n).slice(0, 16)
    let base = n.slice(0, n.length - ext.length)
    while (Buffer.byteLength(base + ext) > 200) base = base.slice(0, -1)
    n = base + ext
  }
  return n
}

const EXT_BY_TYPE: Record<string, string> = {
  'application/zip': '.zip',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'audio/mpeg': '.mp3',
  'application/x-msdownload': '.exe',
  'application/x-iso9660-image': '.iso',
  'application/vnd.android.package-archive': '.apk',
  'image/jpeg': '.jpg',
  'image/png': '.png'
}

export function pickFileName(
  disposition: string | undefined,
  finalUrl: string,
  originalUrl: string,
  contentType: string | null
): string {
  const name = parseContentDisposition(disposition) ?? nameFromUrl(finalUrl) ?? nameFromUrl(originalUrl)
  let clean = sanitizeFileName(name ?? 'download')
  if (!path.extname(clean) && contentType) {
    const ext = EXT_BY_TYPE[contentType.split(';')[0].trim().toLowerCase()]
    if (ext) clean += ext
  }
  return clean
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/** `dir/name`, or `dir/name (2).ext` and so on when the name is taken. */
export async function uniquePath(dir: string, name: string, taken: Set<string> = new Set()): Promise<string> {
  const ext = path.extname(name)
  const base = name.slice(0, name.length - ext.length)
  for (let i = 1; i < 10_000; i++) {
    const candidate = path.join(dir, i === 1 ? name : `${base} (${i})${ext}`)
    if (taken.has(candidate)) continue
    if (!(await exists(candidate)) && !(await exists(`${candidate}.sabipart`))) return candidate
  }
  return path.join(dir, `${base}-${Date.now()}${ext}`)
}

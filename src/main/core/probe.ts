import type { ProbeResult } from '../../shared/types'
import { get } from './net/http'
import type { Route } from './net/socket'
import { pickFileName } from './filename'

export function totalFromContentRange(h: string | undefined): number | null {
  const m = h?.match(/\/(\d+)\s*$/)
  return m ? Number(m[1]) : null
}

/** Follow redirects and learn the file's name, size and whether it can be split. */
export async function probe(
  url: string,
  route: Route,
  headers: Record<string, string> = {}
): Promise<ProbeResult> {
  let current: URL
  try {
    current = new URL(url)
  } catch {
    return { ok: false, error: 'invalid_url' }
  }
  if (current.protocol !== 'http:' && current.protocol !== 'https:')
    return { ok: false, error: 'unsupported_protocol' }
  for (let hop = 0; hop < 12; hop++) {
    const ctrl = new AbortController()
    let res
    try {
      res = await get(current, {
        route,
        headers: { ...headers, range: 'bytes=0-' },
        signal: ctrl.signal,
        headerTimeoutMs: 15_000
      })
    } catch (error) {
      return { ok: false, error: (error as Error).message || 'network' }
    }
    const status = res.statusCode ?? 0
    const h = res.headers
    res.destroy()
    if (status >= 300 && status < 400 && h.location) {
      current = new URL(h.location, current)
      continue
    }
    if (status !== 200 && status !== 206) return { ok: false, error: `http_${status}` }
    const contentType = (h['content-type'] as string | undefined) ?? null
    const encoded = h['content-encoding'] && h['content-encoding'] !== 'identity'
    let size: number | null = null
    let resumable = false
    if (status === 206) {
      size = totalFromContentRange(h['content-range'])
      resumable = size !== null
    } else if (h['content-length'] && !encoded) {
      size = Number(h['content-length'])
      resumable = h['accept-ranges'] === 'bytes'
    }
    if (encoded) resumable = false
    return {
      ok: true,
      url,
      finalUrl: current.toString(),
      fileName: pickFileName(
        h['content-disposition'],
        current.toString(),
        url,
        contentType
      ),
      size,
      resumable,
      contentType,
      etag: (h.etag as string | undefined) ?? undefined,
      lastModified: (h['last-modified'] as string | undefined) ?? undefined
    }
  }
  return { ok: false, error: 'too_many_redirects' }
}

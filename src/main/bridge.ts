import http from 'node:http'
import type { IncomingLink } from '../shared/types'
import { BRIDGE_HEADER } from '../shared/defaults'

/*
 * Local bridge for the browser extension. It only listens on 127.0.0.1, and it only accepts
 * requests carrying the x-sabiload header: a header like that forces a CORS preflight, which
 * this server answers only for browser-extension origins, so ordinary web pages cannot add
 * downloads behind the user's back.
 */

const EXT_ORIGIN = /^(chrome-extension|moz-extension|safari-web-extension|extension):\/\//

export interface BridgeOptions {
  port: number
  version: string
  onLink: (link: IncomingLink) => void
}

function cors(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const origin = req.headers.origin
  if (origin && !EXT_ORIGIN.test(origin)) return false
  if (origin) {
    res.setHeader('access-control-allow-origin', origin)
    res.setHeader('access-control-allow-headers', `content-type, ${BRIDGE_HEADER}`)
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
    res.setHeader('vary', 'origin')
  }
  return true
}

export function startBridge(opts: BridgeOptions): Promise<http.Server | null> {
  const server = http.createServer((req, res) => {
    if (!cors(req, res)) {
      res.writeHead(403).end()
      return
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }
    if (req.headers[BRIDGE_HEADER] !== '1') {
      res.writeHead(403).end()
      return
    }
    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ app: 'Sabiload', version: opts.version }))
      return
    }
    if (req.method === 'POST' && req.url === '/add') {
      let body = ''
      req.setEncoding('utf8')
      req.on('data', (c: string) => {
        body += c
        if (body.length > 256 * 1024) req.destroy()
      })
      req.on('end', () => {
        try {
          const data = JSON.parse(body) as {
            url?: string
            fileName?: string
            size?: number
            referrer?: string
            cookies?: string
            userAgent?: string
          }
          const url = new URL(String(data.url))
          if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
          const headers: Record<string, string> = {}
          if (data.cookies) headers.cookie = String(data.cookies)
          if (data.userAgent) headers['user-agent'] = String(data.userAgent)
          opts.onLink({
            url: url.toString(),
            fileName: data.fileName ? String(data.fileName) : undefined,
            size: typeof data.size === 'number' && data.size > 0 ? data.size : undefined,
            referrer: data.referrer ? String(data.referrer) : undefined,
            headers,
            source: 'browser'
          })
          res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
        } catch {
          res.writeHead(400).end('{"ok":false}')
        }
      })
      return
    }
    res.writeHead(404).end()
  })
  return new Promise((resolve) => {
    server.once('error', (e) => {
      console.warn('[sabiload] bridge could not start', e)
      resolve(null)
    })
    server.listen(opts.port, '127.0.0.1', () => resolve(server))
  })
}

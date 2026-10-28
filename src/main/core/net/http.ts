import http from 'node:http'
import https from 'node:https'
import tls from 'node:tls'
import net from 'node:net'
import { openSocket, type Route } from './socket'

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

type ConnCallback = (err: Error | null, socket?: net.Socket) => void

/** A keep-alive agent whose every connection leaves through one adapter. */
function routeAgent(route: Route, secure: boolean): http.Agent {
  const agent = secure
    ? new https.Agent({ keepAlive: true, maxSockets: 128, keepAliveMsecs: 10_000 })
    : new http.Agent({ keepAlive: true, maxSockets: 128, keepAliveMsecs: 10_000 })
  const create = (options: Record<string, unknown>, cb: ConnCallback): undefined => {
    const host = String(options.host ?? options.hostname ?? 'localhost')
    const port = Number(options.port ?? (secure ? 443 : 80))
    openSocket(route, host, port).then(
      (socket) => {
        if (!secure) return cb(null, socket)
        const servername = (options.servername as string | undefined) ?? (net.isIP(host) ? undefined : host)
        const secured = tls.connect({
          socket,
          servername,
          ALPNProtocols: ['http/1.1'],
          rejectUnauthorized: options.rejectUnauthorized !== false
        })
        cb(null, secured)
      },
      (err: Error) => cb(err)
    )
    return undefined
  }
  ;(agent as unknown as { createConnection: typeof create }).createConnection = create
  return agent
}

const agents = new Map<string, http.Agent>()

export function agentFor(route: Route, secure: boolean): http.Agent {
  const key = `${route.device}|${route.addresses.map((a) => a.address).join(',')}|${secure ? 's' : 'p'}`
  let agent = agents.get(key)
  if (!agent) {
    agent = routeAgent(route, secure)
    agents.set(key, agent)
  }
  return agent
}

export function dropAgents(device?: string): void {
  for (const [key, agent] of agents) {
    if (!device || key.startsWith(`${device}|`)) {
      agent.destroy()
      agents.delete(key)
    }
  }
}

export interface GetOptions {
  route: Route
  headers?: Record<string, string>
  signal?: AbortSignal
  headerTimeoutMs?: number
}

export class HttpStatusError extends Error {
  constructor(
    public status: number,
    public retryAfter: number | null
  ) {
    super(`HTTP ${status}`)
  }
}

/** GET `url` through `route`, resolving once the response headers arrive. */
export function get(url: URL, opts: GetOptions): Promise<http.IncomingMessage> {
  const secure = url.protocol === 'https:'
  const lib = secure ? https : http
  return new Promise((resolve, reject) => {
    const req = lib.request(url, {
      method: 'GET',
      agent: agentFor(opts.route, secure),
      headers: {
        'user-agent': BROWSER_UA,
        accept: '*/*',
        'accept-encoding': 'identity',
        ...opts.headers
      },
      signal: opts.signal
    })
    const timer = setTimeout(
      () => req.destroy(new Error('The server took too long to answer')),
      opts.headerTimeoutMs ?? 20_000
    )
    req.once('response', (res) => {
      clearTimeout(timer)
      resolve(res)
    })
    req.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    req.end()
  })
}

export function retryAfterMs(res: http.IncomingMessage): number | null {
  const h = res.headers['retry-after']
  if (!h) return null
  const secs = Number(h)
  if (Number.isFinite(secs)) return Math.min(120_000, secs * 1000)
  const date = Date.parse(h)
  return Number.isFinite(date) ? Math.max(0, Math.min(120_000, date - Date.now())) : null
}

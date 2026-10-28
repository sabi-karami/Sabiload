import net from 'node:net'
import { lookup } from 'node:dns/promises'
import type { NetAddress } from '../../../shared/types'

/** Where a connection leaves the computer: an adapter and its source addresses. */
export interface Route {
  device: string
  addresses: NetAddress[]
}

/*
 * Pinning connections to one adapter
 * ----------------------------------
 * Windows and macOS pick the outgoing adapter from the socket's source address, so binding
 * `localAddress` is enough. Linux routes purely by its routing table and would send every
 * socket out the default route, so there we create the socket ourselves through libc and set
 * SO_BINDTODEVICE (unprivileged since kernel 5.7), then hand the descriptor to Node.
 */

type BindFn = (device: string, family: 4 | 6) => number
let bindToDevice: BindFn | null = null
let bindingCheck: Promise<boolean> | null = null

export function initDeviceBinding(): Promise<boolean> {
  bindingCheck ??= (async () => {
    if (process.platform !== 'linux') return true
    try {
      const koffi = (await import('koffi')).default
      const libc = koffi.load('libc.so.6')
      const socket = libc.func('int socket(int, int, int)') as (a: number, b: number, c: number) => number
      const setsockopt = libc.func('int setsockopt(int, int, int, const char *, uint32_t)') as (
        fd: number,
        level: number,
        opt: number,
        value: string,
        len: number
      ) => number
      const close = libc.func('int close(int)') as (fd: number) => number
      const SOCK_STREAM_CLOEXEC = 1 | 0o2000000
      const fn: BindFn = (device, family) => {
        const fd = socket(family === 6 ? 10 : 2, SOCK_STREAM_CLOEXEC, 0)
        if (fd < 0) throw new Error(`socket() failed (errno ${koffi.errno()})`)
        if (setsockopt(fd, 1, 25, device, Buffer.byteLength(device) + 1) !== 0) {
          const errno = koffi.errno()
          close(fd)
          throw new Error(`Cannot pin a socket to ${device} (errno ${errno})`)
        }
        return fd
      }
      close(fn('lo', 4))
      bindToDevice = fn
      return true
    } catch (error) {
      console.warn('[sabiload] per-adapter binding unavailable:', error)
      return false
    }
  })()
  return bindingCheck
}

const dnsCache = new Map<string, { at: number; list: NetAddress[] }>()

export async function resolveHost(host: string): Promise<NetAddress[]> {
  const literal = net.isIP(host)
  if (literal) return [{ address: host, family: literal as 4 | 6 }]
  const hit = dnsCache.get(host)
  if (hit && Date.now() - hit.at < 60_000) return hit.list
  const list = (await lookup(host, { all: true, order: 'verbatim' })).map((r) => ({
    address: r.address,
    family: r.family as 4 | 6
  }))
  dnsCache.set(host, { at: Date.now(), list })
  return list
}

function isLoopback(address: string): boolean {
  return address === '::1' || address.startsWith('127.')
}

function connectOnce(
  route: Route,
  local: NetAddress,
  remote: NetAddress,
  port: number,
  timeoutMs: number
): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    let socket: net.Socket
    try {
      if (bindToDevice && !isLoopback(remote.address)) {
        const fd = bindToDevice(route.device, remote.family)
        socket = new net.Socket({ fd, manualStart: true } as net.SocketConstructorOpts)
        socket.connect({ host: remote.address, port, localAddress: local.address, family: remote.family })
      } else {
        socket = net.connect({
          host: remote.address,
          port,
          localAddress: isLoopback(remote.address) && !isLoopback(local.address) ? undefined : local.address,
          family: remote.family
        })
      }
    } catch (error) {
      reject(error)
      return
    }
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`Connection to ${remote.address}:${port} timed out`))
    }, timeoutMs)
    socket.once('connect', () => {
      clearTimeout(timer)
      socket.setNoDelay(true)
      socket.setKeepAlive(true, 15_000)
      resolve(socket)
    })
    socket.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

/** A TCP connection to host:port that leaves through `route`, trying each address pair. */
export async function openSocket(
  route: Route,
  host: string,
  port: number,
  timeoutMs = 10_000
): Promise<net.Socket> {
  const remotes = await resolveHost(host)
  const pairs: Array<[NetAddress, NetAddress]> = []
  for (const remote of remotes) {
    if (isLoopback(remote.address)) {
      const local = route.addresses.find((a) => a.family === remote.family) ?? remote
      pairs.push([local, remote])
      continue
    }
    const local = route.addresses.find((a) => a.family === remote.family)
    if (local) pairs.push([local, remote])
  }
  if (!pairs.length) throw new Error(`No address on ${route.device} can reach ${host}`)
  pairs.sort((a, b) => a[1].family - b[1].family)
  let last: unknown
  const each = Math.max(2500, Math.floor(timeoutMs / Math.min(pairs.length, 3)))
  for (const [local, remote] of pairs.slice(0, 4)) {
    try {
      return await connectOnce(route, local, remote, port, each)
    } catch (error) {
      last = error
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

/** Round-trip time of a TCP handshake through `route`, or null when it cannot get out. */
export async function measureLatency(route: Route): Promise<number | null> {
  const hosts = ['1.1.1.1', '8.8.8.8', 'www.google.com', 'www.bing.com', 'www.aparat.com', '2606:4700:4700::1111']
  for (const host of hosts) {
    let remotes: NetAddress[]
    try {
      remotes = await resolveHost(host)
    } catch {
      continue
    }
    for (const remote of remotes.slice(0, 1)) {
      const local = route.addresses.find((a) => a.family === remote.family)
      if (!local) continue
      const started = performance.now()
      try {
        const s = await connectOnce(route, local, remote, 443, 3000)
        const ms = performance.now() - started
        s.destroy()
        return Math.max(1, Math.round(ms))
      } catch {
        /* try the next target */
      }
    }
  }
  return null
}

import { EventEmitter } from 'node:events'
import type { NetKind, NetworkInfo, Settings } from '../../shared/types'
import { NET_PALETTE } from '../../shared/defaults'
import { listInterfaces, type RawInterface } from './net/interfaces'
import { measureLatency, type Route } from './net/socket'
import { dropAgents } from './net/http'
import { RateLimiter } from './limiter'
import type { EngineNet } from './engine'
import { readJson, writeJson } from './jsonStore'

interface UsageFile {
  day: string
  month: string
  today: Record<string, number>
  monthly: Record<string, number>
}

const KIND_NAMES: Record<NetKind, string> = {
  wifi: 'Wi-Fi',
  ethernet: 'Ethernet',
  cellular: 'Mobile data',
  usb: 'USB tethering',
  vpn: 'VPN',
  other: 'Network'
}

function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

const dayKey = (d = new Date()): string => d.toISOString().slice(0, 10)
const monthKey = (d = new Date()): string => d.toISOString().slice(0, 7)

/** Watches the computer's adapters and owns everything per network: limits, usage, routes. */
export class NetworkService extends EventEmitter {
  private raw: RawInterface[] = []
  private list: NetworkInfo[] = []
  private latency = new Map<string, number | null>()
  private limiters = new Map<string, RateLimiter>()
  private speeds: Record<string, number> = {}
  private usage: UsageFile = { day: dayKey(), month: monthKey(), today: {}, monthly: {} }
  private timers: NodeJS.Timeout[] = []
  private signature = ''

  constructor(
    private settings: () => Settings,
    private usagePath: string
  ) {
    super()
  }

  async start(): Promise<void> {
    this.usage = await readJson(this.usagePath, this.usage)
    this.rollUsage()
    await this.refresh()
    void this.probeLatency()
    this.timers.push(setInterval(() => void this.refresh(), 4000))
    this.timers.push(setInterval(() => void this.probeLatency(), 20_000))
    this.timers.push(setInterval(() => void writeJson(this.usagePath, this.usage), 30_000))
  }

  async stop(): Promise<void> {
    for (const t of this.timers) clearInterval(t)
    await writeJson(this.usagePath, this.usage)
  }

  private rollUsage(): void {
    if (this.usage.day !== dayKey()) {
      this.usage.day = dayKey()
      this.usage.today = {}
    }
    if (this.usage.month !== monthKey()) {
      this.usage.month = monthKey()
      this.usage.monthly = {}
    }
  }

  async refresh(): Promise<NetworkInfo[]> {
    try {
      this.raw = await listInterfaces()
    } catch (error) {
      console.warn('[sabiload] listing adapters failed', error)
    }
    const before = new Set(this.list.map((n) => n.id))
    this.rebuild()
    const sig = JSON.stringify(this.list.map((n) => [n.id, n.addresses, n.enabled, n.capped]))
    if (sig !== this.signature) {
      for (const id of before) if (!this.list.some((n) => n.id === id)) dropAgents(id)
      this.signature = sig
      this.emit('topology')
    }
    this.emit('change', this.list)
    return this.list
  }

  rebuild(): void {
    const s = this.settings()
    this.rollUsage()
    const counts = new Map<NetKind, number>()
    for (const r of this.raw) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1)
    this.list = this.raw.map((r, i) => {
      const defaultName =
        process.platform === 'win32'
          ? r.device
          : r.hardware && process.platform === 'darwin'
            ? r.hardware
            : (counts.get(r.kind) ?? 0) > 1
              ? `${KIND_NAMES[r.kind]} · ${r.device}`
              : KIND_NAMES[r.kind]
      const today = this.usage.today[r.device] ?? 0
      const month = this.usage.monthly[r.device] ?? 0
      const dailyCap = s.netDailyCaps[r.device] ?? 0
      const monthlyCap = s.netMonthlyCaps[r.device] ?? 0
      const limit = s.netLimits[r.device] ?? 0
      this.limiter(r.device).setRate(limit)
      return {
        id: r.device,
        device: r.device,
        name: s.netNames[r.device] || defaultName,
        hardware: r.hardware,
        kind: r.kind,
        addresses: r.addresses,
        color: s.netColors[r.device] || NET_PALETTE[(hash(r.device) + i) % NET_PALETTE.length],
        enabled: !s.disabledNets.includes(r.device),
        latency: this.latency.get(r.device) ?? null,
        online: this.latency.has(r.device) ? this.latency.get(r.device) !== null : null,
        limit,
        dailyCap,
        monthlyCap,
        usage: { today, month },
        capped: (dailyCap > 0 && today >= dailyCap) || (monthlyCap > 0 && month >= monthlyCap),
        speed: Math.round(this.speeds[r.device] ?? 0)
      }
    })
  }

  private async probeLatency(): Promise<void> {
    await Promise.all(
      this.raw.map(async (r) => {
        this.latency.set(r.device, await measureLatency({ device: r.device, addresses: r.addresses }))
      })
    )
    this.rebuild()
    this.emit('change', this.list)
  }

  networks(): NetworkInfo[] {
    return this.list
  }

  limiter(id: string): RateLimiter {
    let l = this.limiters.get(id)
    if (!l) {
      l = new RateLimiter(0)
      this.limiters.set(id, l)
    }
    return l
  }

  /** Networks a download may use right now. */
  engineNets(selection: string[] | null | undefined): EngineNet[] {
    const usable = this.list.filter((n) => n.enabled && !n.capped)
    const picked = selection?.length ? usable.filter((n) => selection.includes(n.id)) : usable
    return picked.map((n) => ({
      id: n.id,
      route: { device: n.device, addresses: n.addresses },
      limiter: this.limiter(n.id)
    }))
  }

  /** The quickest network for a short request such as probing a link. */
  primaryRoute(selection?: string[] | null): Route | null {
    let nets = this.engineNets(selection)
    if (!nets.length) nets = this.engineNets(null)
    if (!nets.length) {
      const any = this.list[0]
      return any ? { device: any.device, addresses: any.addresses } : null
    }
    const ranked = [...nets].sort(
      (a, b) => (this.latency.get(a.id) ?? 9999) - (this.latency.get(b.id) ?? 9999)
    )
    return ranked[0].route
  }

  addUsage(id: string, bytes: number): void {
    if (bytes <= 0) return
    this.rollUsage()
    this.usage.today[id] = (this.usage.today[id] ?? 0) + bytes
    this.usage.monthly[id] = (this.usage.monthly[id] ?? 0) + bytes
    const n = this.list.find((x) => x.id === id)
    if (n) {
      n.usage = { today: this.usage.today[id], month: this.usage.monthly[id] }
      const capped =
        (n.dailyCap > 0 && n.usage.today >= n.dailyCap) ||
        (n.monthlyCap > 0 && n.usage.month >= n.monthlyCap)
      if (capped !== n.capped) {
        n.capped = capped
        this.emit('topology')
      }
    }
  }

  setSpeeds(speeds: Record<string, number>): void {
    this.speeds = speeds
    for (const n of this.list) n.speed = Math.round(speeds[n.id] ?? 0)
  }
}

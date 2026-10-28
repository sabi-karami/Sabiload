import { EventEmitter } from 'node:events'
import { open, rename, unlink, writeFile, type FileHandle } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import type { NetStat, SegmentView, SpeedSample, StreamsMode } from '../../shared/types'
import { get, retryAfterMs } from './net/http'
import type { Route } from './net/socket'
import { RateLimiter, sleep } from './limiter'
import { complement, mergeRanges, totalLength, type Range } from './ranges'
import { totalFromContentRange } from './probe'

/*
 * Sabiload transfer engine
 * ------------------------
 * The file is cut into chunks that sit in one shared queue. Every network runs its own pool of
 * streams; each stream asks for the next chunk, so faster networks naturally take more of the
 * file. When the queue runs dry, an idle stream splits the busiest unfinished chunk in half and
 * takes the back half (work stealing), so a slow connection never holds up the finish. A stream
 * that stops receiving is cut loose and its remaining bytes are handed to someone else.
 * In Auto mode each network grows its pool while extra streams still add speed and shrinks it
 * when the server pushes back.
 */

export interface EngineNet {
  id: string
  route: Route
  limiter: RateLimiter
}

export interface DoneSeg {
  s: number
  e: number
  n: string | null
}

export interface EngineInit {
  url: string
  partPath: string
  statePath: string
  size: number | null
  resumable: boolean
  headers: Record<string, string>
  nets: EngineNet[]
  streamsMode: StreamsMode
  global: RateLimiter
  done: DoneSeg[]
}

export interface EngineSnapshot {
  received: number
  speed: number
  nets: Record<string, NetStat>
  waiting: boolean
}

export class EngineError extends Error {
  constructor(
    public code: string,
    message?: string
  ) {
    super(message ?? code)
  }
}

interface Seg {
  start: number
  pos: number
  flushed: number
  end: number
  net: string
  stream: Stream | null
  lastData: number
}

interface Stream {
  net: NetState
  seg: Seg | null
  ctrl: AbortController | null
}

interface NetState {
  net: EngineNet
  streams: Set<Stream>
  loops: Set<Promise<void>>
  target: number
  bytes: number
  lastBytes: number
  speed: number
  failures: number
  fatal: number
  backoffUntil: number
  removed: boolean
  grew: boolean
  prevSpeed: number
  frozenUntil: number
  lastEval: number
}

const MIN_STEAL = 384 * 1024
const STALL_MS = 12_000
const AUTO_START = 4
const AUTO_MAX = 32
const FIXED_MAX = 64

export class Engine extends EventEmitter {
  private fh: FileHandle | null = null
  private url: URL
  private running = false
  private stopCtrl = new AbortController()
  private nets = new Map<string, NetState>()
  private pending: Range[] = []
  private active = new Set<Seg>()
  private doneSegs: DoneSeg[] = []
  private received = 0
  private ticker: NodeJS.Timeout | null = null
  private lastTick = performance.now()
  private lastCheckpoint = 0
  private lastSample = 0
  private history: SpeedSample[] = []
  private settle: { resolve: (v: 'complete' | 'stopped') => void; reject: (e: Error) => void } | null =
    null
  private finished = false
  private single: boolean
  private singleLoop: Promise<void> | null = null
  private redirected: URL | null = null

  constructor(private init: EngineInit) {
    super()
    this.url = new URL(init.url)
    this.single = !init.resumable || init.size === null
  }

  get size(): number | null {
    return this.init.size
  }

  run(): Promise<'complete' | 'stopped'> {
    return new Promise((resolve, reject) => {
      this.settle = { resolve, reject }
      this.begin().catch((error) => this.fail(error))
    })
  }

  private async begin(): Promise<void> {
    this.running = true
    try {
      this.fh = await open(this.init.partPath, 'r+')
    } catch {
      this.fh = await open(this.init.partPath, 'w+')
      this.init.done = []
    }
    if (this.single) {
      this.init.done = []
      await this.fh.truncate(0)
    } else {
      const size = this.init.size as number
      const stat = await this.fh.stat()
      if (stat.size !== size) await this.fh.truncate(size)
      this.doneSegs = this.init.done.map((d) => ({ ...d }))
      this.pending = complement(
        this.doneSegs.map((d) => [d.s, d.e] as Range),
        size
      )
      this.received = size - totalLength(this.pending)
    }
    for (const n of this.init.nets) this.addNet(n)
    this.ticker = setInterval(() => this.tick(), 250)
    if (this.single) this.singleLoop = this.runSingle()
    else {
      if (!this.pending.length) return void this.maybeFinish()
      for (const ns of this.nets.values()) this.fill(ns)
    }
    this.emitProgress()
  }

  // ---------- networks ----------

  private addNet(net: EngineNet): void {
    const existing = this.nets.get(net.id)
    if (existing && !existing.removed) {
      existing.net = net
      return
    }
    const fixed = typeof this.init.streamsMode === 'number' ? this.init.streamsMode : null
    this.nets.set(net.id, {
      net,
      streams: new Set(),
      loops: new Set(),
      target: fixed ? Math.min(FIXED_MAX, Math.max(1, fixed)) : AUTO_START,
      bytes: existing?.bytes ?? 0,
      lastBytes: existing?.bytes ?? 0,
      speed: 0,
      failures: 0,
      fatal: 0,
      backoffUntil: 0,
      removed: false,
      grew: false,
      prevSpeed: 0,
      frozenUntil: 0,
      lastEval: performance.now()
    })
  }

  /** Networks can join or leave while the transfer runs. */
  setNets(nets: EngineNet[]): void {
    const ids = new Set(nets.map((n) => n.id))
    for (const [id, ns] of this.nets) {
      if (!ids.has(id) && !ns.removed) {
        ns.removed = true
        for (const s of ns.streams) s.ctrl?.abort()
      }
    }
    for (const n of nets) this.addNet(n)
    if (!this.running) return
    if (this.single) {
      if (!this.singleLoop) this.singleLoop = this.runSingle()
    } else for (const ns of this.nets.values()) this.fill(ns)
  }

  setStreamsMode(mode: StreamsMode): void {
    this.init.streamsMode = mode
    for (const ns of this.nets.values()) {
      ns.target = typeof mode === 'number' ? Math.min(FIXED_MAX, Math.max(1, mode)) : AUTO_START
      this.fill(ns)
    }
  }

  private liveNets(): NetState[] {
    return [...this.nets.values()].filter((n) => !n.removed)
  }

  // ---------- work queue ----------

  private chunkSize(): number {
    const size = this.init.size ?? 0
    const streams = Math.max(1, this.liveNets().reduce((s, n) => s + n.target, 0))
    const ideal = size / (streams * 6)
    return Math.round(Math.min(32 * 1024 * 1024, Math.max(1024 * 1024, ideal)))
  }

  private stealable(): Seg | null {
    let victim: Seg | null = null
    let best = 0
    const now = Date.now()
    for (const s of this.active) {
      if (!s.stream) continue
      const left = s.end - s.pos
      const stalled = now - s.lastData > 5000
      const score = stalled ? left * 4 : left
      if (left >= MIN_STEAL * 2 || (stalled && left > 0)) {
        if (score > best) {
          best = score
          victim = s
        }
      }
    }
    return victim
  }

  private hasWork(): boolean {
    return this.pending.length > 0 || this.stealable() !== null
  }

  private takeWork(ns: NetState): Seg | null {
    const now = Date.now()
    if (this.pending.length) {
      const [a, b] = this.pending[0]
      const end = Math.min(b, a + this.chunkSize())
      if (end >= b) this.pending.shift()
      else this.pending[0] = [end, b]
      const seg: Seg = { start: a, pos: a, flushed: a, end, net: ns.net.id, stream: null, lastData: now }
      this.active.add(seg)
      return seg
    }
    const victim = this.stealable()
    if (!victim) return null
    const stalled = now - victim.lastData > 5000
    let from: number
    if (stalled) {
      from = victim.pos
      victim.stream?.ctrl?.abort()
    } else {
      from = victim.pos + Math.floor((victim.end - victim.pos) / 2)
    }
    const seg: Seg = {
      start: from,
      pos: from,
      flushed: from,
      end: victim.end,
      net: ns.net.id,
      stream: null,
      lastData: now
    }
    victim.end = from
    this.active.add(seg)
    return seg
  }

  /** A finished, failed or abandoned segment gives its unfinished tail back to the queue. */
  private release(seg: Seg): void {
    this.active.delete(seg)
    seg.stream = null
    if (seg.flushed > seg.start) this.doneSegs.push({ s: seg.start, e: seg.flushed, n: seg.net })
    if (seg.flushed < seg.end) {
      this.pending.push([seg.flushed, seg.end])
      this.pending = mergeRanges(this.pending)
    }
  }

  private fill(ns: NetState): void {
    if (!this.running || ns.removed || this.single) return
    while (ns.streams.size < ns.target && this.hasWork()) {
      const stream: Stream = { net: ns, seg: null, ctrl: null }
      ns.streams.add(stream)
      const loop = this.streamLoop(stream).finally(() => {
        ns.loops.delete(loop)
      })
      ns.loops.add(loop)
    }
  }

  private async streamLoop(st: Stream): Promise<void> {
    const ns = st.net
    try {
      while (this.running && !ns.removed && ns.streams.size <= ns.target) {
        const wait = ns.backoffUntil - Date.now()
        if (wait > 0) {
          await sleep(wait, this.stopCtrl.signal)
          continue
        }
        const seg = this.takeWork(ns)
        if (!seg) break
        st.seg = seg
        seg.stream = st
        try {
          await this.fetchSegment(st, seg)
          ns.failures = 0
          ns.fatal = 0
        } catch (error) {
          this.onStreamError(ns, error as Error)
        } finally {
          st.seg = null
          st.ctrl = null
          this.release(seg)
        }
      }
    } finally {
      ns.streams.delete(st)
      this.maybeFinish()
    }
  }

  private onStreamError(ns: NetState, error: Error): void {
    if (!this.running || ns.removed) return
    if (error instanceof EngineError) {
      if (error.code === 'disk_full' || error.code === 'changed' || error.code === 'range') {
        this.fail(error)
        return
      }
      if (error.code.startsWith('http_4')) {
        ns.fatal++
        const live = this.liveNets()
        if (live.length && live.every((n) => n.fatal >= 3)) {
          this.fail(error)
          return
        }
      }
    }
    ns.failures++
    const retry = (error as { retryAfter?: number | null }).retryAfter
    ns.backoffUntil = Date.now() + (retry ?? Math.min(30_000, 300 * 2 ** Math.min(ns.failures, 7)))
    if (typeof this.init.streamsMode !== 'number' && ns.failures >= 2)
      ns.target = Math.max(1, Math.floor(ns.target * 0.75))
  }

  private async request(st: Stream, range: string | null): Promise<IncomingMessage> {
    let target = this.redirected ?? this.url
    for (let hop = 0; hop < 8; hop++) {
      const ctrl = new AbortController()
      st.ctrl = ctrl
      const onStop = (): void => ctrl.abort()
      this.stopCtrl.signal.addEventListener('abort', onStop, { once: true })
      let res: IncomingMessage
      try {
        res = await get(target, {
          route: st.net.net.route,
          headers: range ? { ...this.init.headers, range } : this.init.headers,
          signal: ctrl.signal
        })
      } finally {
        this.stopCtrl.signal.removeEventListener('abort', onStop)
      }
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        target = new URL(res.headers.location, target)
        this.redirected = target
        continue
      }
      if (status === 200 || status === 206) return res
      res.resume()
      const err = new EngineError(`http_${status}`)
      ;(err as unknown as { retryAfter: number | null }).retryAfter = retryAfterMs(res)
      if (status === 429 || status === 503) {
        if (typeof this.init.streamsMode !== 'number')
          st.net.target = Math.max(1, st.net.target - 1)
      }
      throw err
    }
    throw new EngineError('too_many_redirects')
  }

  private async fetchSegment(st: Stream, seg: Seg): Promise<void> {
    const res = await this.request(st, `bytes=${seg.pos}-${seg.end - 1}`)
    if (res.statusCode === 206) {
      const startMatch = String(res.headers['content-range'] ?? '').match(/bytes\s+(\d+)-/)
      const total = totalFromContentRange(res.headers['content-range'])
      if (total !== null && total !== this.init.size) {
        res.destroy()
        throw new EngineError('changed')
      }
      if (startMatch && Number(startMatch[1]) !== seg.pos) {
        res.destroy()
        throw new EngineError('range')
      }
    } else if (seg.pos !== 0) {
      res.destroy()
      throw new EngineError('range')
    }
    await this.pump(res, st, seg)
    if (seg.pos < seg.end && this.running && st.ctrl && !st.ctrl.signal.aborted)
      throw new Error('The connection closed early')
  }

  private async pump(res: IncomingMessage, st: Stream, seg: Seg): Promise<void> {
    const ns = st.net
    seg.lastData = Date.now()
    try {
      for await (const chunk of res as AsyncIterable<Buffer>) {
        if (!this.running) break
        const room = seg.end - seg.pos
        if (room <= 0) break
        const buf = chunk.length > room ? chunk.subarray(0, room) : chunk
        const at = seg.pos
        seg.pos += buf.length
        seg.lastData = Date.now()
        await this.write(buf, at)
        seg.flushed = Math.max(seg.flushed, at + buf.length)
        ns.bytes += buf.length
        this.received += buf.length
        const wait = Math.max(this.init.global.take(buf.length), ns.net.limiter.take(buf.length))
        if (wait > 0) await sleep(Math.min(wait, 1500), st.ctrl?.signal)
        if (seg.pos >= seg.end) break
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError' || st.ctrl?.signal.aborted) return
      throw error
    } finally {
      if (!res.complete) res.destroy()
    }
  }

  private async write(buf: Buffer, at: number): Promise<void> {
    try {
      await this.fh!.write(buf, 0, buf.length, at)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      throw new EngineError(code === 'ENOSPC' ? 'disk_full' : 'disk', (error as Error).message)
    }
  }

  // ---------- servers without ranges ----------

  private async runSingle(): Promise<void> {
    let attempts = 0
    while (this.running) {
      const ns = this.liveNets()[0]
      if (!ns) {
        this.singleLoop = null
        return
      }
      const st: Stream = { net: ns, seg: null, ctrl: null }
      ns.streams.add(st)
      try {
        this.received = 0
        await this.fh!.truncate(0)
        const res = await this.request(st, null)
        const len = Number(res.headers['content-length'])
        const seg: Seg = {
          start: 0,
          pos: 0,
          flushed: 0,
          end: Number.isFinite(len) && len > 0 ? len : Number.MAX_SAFE_INTEGER,
          net: ns.net.id,
          stream: st,
          lastData: Date.now()
        }
        this.active.add(seg)
        await this.pump(res, st, seg)
        this.active.delete(seg)
        if (!this.running) return
        if (seg.end !== Number.MAX_SAFE_INTEGER && seg.pos < seg.end)
          throw new Error('The connection closed early')
        this.doneSegs = [{ s: 0, e: seg.pos, n: ns.net.id }]
        if (this.init.size === null) this.init.size = seg.pos
        await this.finish()
        return
      } catch (error) {
        this.active.clear()
        if (!this.running) return
        if (error instanceof EngineError && error.code.startsWith('http_4') && ++attempts >= 3)
          return this.fail(error)
        if (++attempts > 12) return this.fail(error as Error)
        await sleep(Math.min(20_000, 500 * 2 ** attempts), this.stopCtrl.signal)
      } finally {
        ns.streams.delete(st)
      }
    }
  }

  // ---------- bookkeeping ----------

  private tick(): void {
    const now = performance.now()
    const dt = (now - this.lastTick) / 1000
    this.lastTick = now
    if (dt <= 0) return
    for (const ns of this.nets.values()) {
      const inst = (ns.bytes - ns.lastBytes) / dt
      ns.lastBytes = ns.bytes
      ns.speed = ns.speed ? ns.speed * 0.72 + inst * 0.28 : inst
      if (ns.removed) ns.speed = 0
    }
    const wall = Date.now()
    for (const s of this.active) {
      if (s.stream && wall - s.lastData > STALL_MS) {
        s.lastData = wall
        s.stream.ctrl?.abort()
      }
    }
    if (!this.single && this.running) {
      for (const ns of this.liveNets()) {
        this.autoscale(ns, now)
        this.fill(ns)
      }
    }
    if (wall - this.lastSample >= 1000) {
      this.lastSample = wall
      const nets: Record<string, number> = {}
      for (const [id, ns] of this.nets) nets[id] = Math.round(ns.speed)
      this.history.push({ t: wall, total: Math.round(this.totalSpeed()), nets })
      if (this.history.length > 120) this.history.shift()
    }
    if (wall - this.lastCheckpoint >= 2000) {
      this.lastCheckpoint = wall
      void this.checkpoint()
    }
    this.emitProgress()
  }

  private autoscale(ns: NetState, now: number): void {
    if (typeof this.init.streamsMode === 'number') return
    if (now - ns.lastEval < 3000) return
    ns.lastEval = now
    if (ns.net.limiter.limit || this.init.global.limit) return
    if (ns.grew && ns.speed < ns.prevSpeed * 1.06) {
      ns.target = Math.max(2, ns.target - 2)
      ns.frozenUntil = now + 30_000
    }
    ns.grew = false
    if (
      now >= ns.frozenUntil &&
      ns.failures === 0 &&
      ns.target < AUTO_MAX &&
      ns.streams.size >= ns.target &&
      this.pending.length > 0
    ) {
      ns.prevSpeed = ns.speed
      ns.target = Math.min(AUTO_MAX, ns.target + Math.max(2, Math.round(ns.target / 2)))
      ns.grew = true
    }
  }

  private totalSpeed(): number {
    let s = 0
    for (const ns of this.nets.values()) s += ns.speed
    return s
  }

  snapshot(): EngineSnapshot {
    const nets: Record<string, NetStat> = {}
    for (const [id, ns] of this.nets)
      nets[id] = { bytes: ns.bytes, speed: Math.round(ns.speed), streams: ns.streams.size }
    return {
      received: this.received,
      speed: Math.round(this.totalSpeed()),
      nets,
      waiting: this.running && this.liveNets().length === 0
    }
  }

  segments(): SegmentView[] {
    const out: SegmentView[] = this.compactDone().map((d) => ({ s: d.s, e: d.e, p: d.e, n: d.n, active: false }))
    for (const s of this.active)
      out.push({ s: s.start, e: Math.max(s.end, s.pos), p: s.pos, n: s.net, active: true })
    return out
  }

  speedHistory(): SpeedSample[] {
    return this.history
  }

  private compactDone(): DoneSeg[] {
    const sorted = [...this.doneSegs].sort((a, b) => a.s - b.s)
    const out: DoneSeg[] = []
    for (const d of sorted) {
      const last = out[out.length - 1]
      if (last && last.n === d.n && d.s <= last.e) last.e = Math.max(last.e, d.e)
      else out.push({ ...d })
    }
    this.doneSegs = out
    return out
  }

  private emitProgress(): void {
    this.emit('progress', this.snapshot())
  }

  /** Completed bytes, saved so a restart picks up where this left off. */
  doneForSave(): DoneSeg[] {
    const live = [...this.active]
      .filter((s) => s.flushed > s.start)
      .map((s) => ({ s: s.start, e: s.flushed, n: s.net }))
    const all = [...this.compactDone(), ...live]
    return all.length > 4000 ? mergeRanges(all.map((d) => [d.s, d.e] as Range)).map(([s, e]) => ({ s, e, n: null })) : all
  }

  private async checkpoint(): Promise<void> {
    if (this.single || this.finished) return
    const body = JSON.stringify({ v: 1, url: this.init.url, size: this.init.size, done: this.doneForSave() })
    const tmp = `${this.init.statePath}.tmp`
    try {
      await writeFile(tmp, body)
      await rename(tmp, this.init.statePath)
    } catch {
      /* the next checkpoint will try again */
    }
  }

  private maybeFinish(): void {
    if (!this.running || this.finished || this.single) return
    if (this.pending.length || this.active.size) return
    void this.finish()
  }

  private async finish(): Promise<void> {
    if (this.finished) return
    this.finished = true
    this.running = false
    this.cleanupTimers()
    try {
      await this.fh?.sync()
    } catch {
      /* not all filesystems support fsync */
    }
    await this.fh?.close()
    this.fh = null
    await unlink(this.init.statePath).catch(() => undefined)
    this.emitProgress()
    this.settle?.resolve('complete')
  }

  private fail(error: Error): void {
    if (this.finished) return
    this.finished = true
    void this.shutdown().then(() => this.settle?.reject(error))
  }

  private cleanupTimers(): void {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
  }

  private async shutdown(): Promise<void> {
    this.running = false
    this.stopCtrl.abort()
    this.cleanupTimers()
    const loops: Promise<void>[] = []
    for (const ns of this.nets.values()) loops.push(...ns.loops)
    if (this.singleLoop) loops.push(this.singleLoop)
    await Promise.allSettled(loops)
    for (const s of [...this.active]) this.release(s)
    if (!this.single) {
      this.lastCheckpoint = 0
      const body = JSON.stringify({ v: 1, url: this.init.url, size: this.init.size, done: this.doneForSave() })
      await writeFile(this.init.statePath, body).catch(() => undefined)
    }
    await this.fh?.close().catch(() => undefined)
    this.fh = null
  }

  /** Pause: stop every stream, save progress, keep the partial file. */
  async stop(): Promise<void> {
    if (this.finished) return
    this.finished = true
    await this.shutdown()
    this.emitProgress()
    this.settle?.resolve('stopped')
  }
}

import { EventEmitter } from 'node:events'
import { mkdir, rename, rm, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  DownloadAction,
  DownloadDetail,
  DownloadItem,
  NewDownloadRequest,
  ProbeResult,
  Settings
} from '../../shared/types'
import { categoryOf, CATEGORY_FOLDERS } from '../../shared/categories'
import { scheduleAllows } from '../../shared/schedule'
import { Engine, EngineError, type DoneSeg, type EngineSnapshot } from './engine'
import { RateLimiter } from './limiter'
import { probe } from './probe'
import { sanitizeFileName, uniquePath } from './filename'
import type { NetworkService } from './networks'
import { readJson, writeJson } from './jsonStore'

export interface ManagerHooks {
  settings: () => Settings
  openPath: (p: string) => Promise<void>
  showInFolder: (p: string) => void
  trash: (p: string) => Promise<void>
}

const ACTIVE = new Set(['starting', 'downloading', 'waiting'])

/** Owns the download list: the queue, persistence, the schedule and one Engine per transfer. */
export class DownloadManager extends EventEmitter {
  private items = new Map<string, DownloadItem>()
  private order: string[] = []
  private engines = new Map<string, Engine>()
  private starting = new Set<string>()
  private dirty = new Set<string>()
  private saveTimer: NodeJS.Timeout | null = null
  private flushTimer: NodeJS.Timeout | null = null
  private scheduleTimer: NodeJS.Timeout | null = null
  private lastNetBytes = new Map<string, Record<string, number>>()
  readonly global = new RateLimiter(0)

  constructor(
    private file: string,
    private nets: NetworkService,
    private hooks: ManagerHooks
  ) {
    super()
  }

  async load(): Promise<void> {
    const saved = await readJson<{ items: DownloadItem[] }>(this.file, { items: [] })
    for (const item of saved.items ?? []) {
      if (ACTIVE.has(item.status) || item.status === 'scheduled') item.status = 'queued'
      item.speed = 0
      item.eta = null
      for (const n of Object.values(item.nets ?? {})) {
        n.speed = 0
        n.streams = 0
      }
      this.items.set(item.id, item)
      this.order.push(item.id)
    }
    this.applyLimits()
    this.flushTimer = setInterval(() => this.flush(), 300)
    this.scheduleTimer = setInterval(() => this.checkSchedule(), 15_000)
    this.nets.on('topology', () => this.onTopology())
    this.pump()
  }

  applyLimits(): void {
    const s = this.hooks.settings()
    this.global.setRate(s.slowMode ? s.slowLimit : s.globalLimit)
  }

  list(): DownloadItem[] {
    return this.order.map((id) => this.items.get(id)!).filter(Boolean)
  }

  activeCount(): number {
    return this.list().filter((i) => ACTIVE.has(i.status)).length
  }

  totalSpeed(): number {
    return this.list().reduce((s, i) => s + (i.status === 'downloading' ? i.speed : 0), 0)
  }

  private touch(item: DownloadItem): void {
    this.dirty.add(item.id)
    if (!this.saveTimer)
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null
        void this.save()
      }, 1200)
  }

  private flush(): void {
    const speeds: Record<string, number> = {}
    for (const item of this.items.values()) {
      if (item.status !== 'downloading') continue
      for (const [id, n] of Object.entries(item.nets)) speeds[id] = (speeds[id] ?? 0) + n.speed
    }
    this.nets.setSpeeds(speeds)
    if (!this.dirty.size) return
    const changed = [...this.dirty].map((id) => this.items.get(id)).filter(Boolean) as DownloadItem[]
    this.dirty.clear()
    this.emit('changed', changed)
  }

  async save(): Promise<void> {
    await writeJson(this.file, { v: 1, items: this.list() })
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer)
    if (this.scheduleTimer) clearInterval(this.scheduleTimer)
    await Promise.all([...this.engines.values()].map((e) => e.stop()))
    for (const item of this.items.values()) if (ACTIVE.has(item.status)) item.status = 'queued'
    await this.save()
  }

  // ---------- adding ----------

  async probeUrl(url: string, headers?: Record<string, string>): Promise<ProbeResult> {
    const route = this.nets.primaryRoute()
    if (!route) return { ok: false, error: 'no_network' }
    return probe(url, route, headers)
  }

  async add(req: NewDownloadRequest): Promise<string[]> {
    const s = this.hooks.settings()
    const ids: string[] = []
    const urls = [...new Set(req.urls.map((u) => u.trim()).filter(Boolean))]
    for (const url of urls) {
      let name = req.fileName && urls.length === 1 ? sanitizeFileName(req.fileName) : ''
      if (!name) {
        try {
          name = sanitizeFileName(decodeURIComponent(new URL(url).pathname.split('/').pop() || 'download'))
        } catch {
          name = 'download'
        }
      }
      const item: DownloadItem = {
        id: randomUUID(),
        url,
        fileName: name,
        dir: req.dir || s.downloadDir,
        size: null,
        received: 0,
        status: req.start ? 'queued' : 'paused',
        resumable: false,
        createdAt: Date.now(),
        category: categoryOf(name),
        networks: req.networks ?? null,
        streamsMode: req.streamsMode ?? s.streamsMode,
        headers: req.headers,
        referrer: req.referrer,
        speed: 0,
        peak: 0,
        eta: null,
        activeMs: 0,
        nets: {},
        userFileName: Boolean(req.fileName && urls.length === 1)
      }
      this.items.set(item.id, item)
      this.order.unshift(item.id)
      ids.push(item.id)
      this.touch(item)
      if (!req.start) void this.prefetchInfo(item)
    }
    this.pump()
    return ids
  }

  /** Fill in size and name for items added without starting. */
  private async prefetchInfo(item: DownloadItem): Promise<void> {
    const route = this.nets.primaryRoute(item.networks)
    if (!route) return
    const r = await probe(item.url, route, this.headersFor(item))
    if (!r.ok || item.probed) return
    this.applyProbe(item, r)
    this.touch(item)
  }

  private applyProbe(item: DownloadItem, r: Extract<ProbeResult, { ok: true }>): void {
    item.probed = true
    item.finalUrl = r.finalUrl
    item.size = r.size
    item.resumable = r.resumable
    item.etag = r.etag
    item.lastModified = r.lastModified
    if (!item.userFileName && !item.filePath) {
      item.fileName = r.fileName
      item.category = categoryOf(r.fileName)
    }
  }

  private headersFor(item: DownloadItem): Record<string, string> {
    const h: Record<string, string> = { ...(item.headers ?? {}) }
    if (item.referrer && !h.referer) h.referer = item.referrer
    return h
  }

  // ---------- queue ----------

  private scheduleOpen(): boolean {
    return scheduleAllows(this.hooks.settings().schedule)
  }

  pump(): void {
    const s = this.hooks.settings()
    if (!this.scheduleOpen()) {
      for (const item of this.items.values())
        if (item.status === 'queued') {
          item.status = 'scheduled'
          this.touch(item)
        }
      return
    }
    let running = this.activeCount()
    for (const id of [...this.order].reverse()) {
      if (running >= s.maxConcurrent) break
      const item = this.items.get(id)
      if (!item || (item.status !== 'queued' && item.status !== 'scheduled')) continue
      running++
      void this.start(item)
    }
  }

  private checkSchedule(): void {
    const open = this.scheduleOpen()
    if (open) {
      for (const item of this.items.values())
        if (item.status === 'scheduled') {
          item.status = 'queued'
          this.touch(item)
        }
      this.pump()
      return
    }
    for (const [id, engine] of this.engines) {
      const item = this.items.get(id)
      if (!item) continue
      item.status = 'scheduled'
      this.touch(item)
      void engine.stop()
    }
    this.pump()
  }

  private onTopology(): void {
    for (const [id, engine] of this.engines) {
      const item = this.items.get(id)
      if (item) engine.setNets(this.nets.engineNets(item.networks))
    }
    for (const item of this.items.values())
      if (item.status === 'waiting' && !this.engines.has(item.id) && !this.starting.has(item.id)) {
        item.status = 'queued'
        this.touch(item)
      }
    this.pump()
  }

  private partPath(item: DownloadItem): string {
    return `${item.filePath}.sabipart`
  }

  private async start(item: DownloadItem): Promise<void> {
    if (this.engines.has(item.id) || this.starting.has(item.id)) return
    this.starting.add(item.id)
    item.status = 'starting'
    item.error = undefined
    this.touch(item)
    let engine: Engine | null = null
    try {
      const nets = this.nets.engineNets(item.networks)
      if (!nets.length) {
        item.status = 'waiting'
        this.touch(item)
        return
      }
      if (!item.probed || !item.filePath) {
        const r = await probe(item.url, nets[0].route, this.headersFor(item))
        if (!r.ok) throw new EngineError(r.error)
        if (item.probed && item.size !== null && r.size !== item.size) {
          item.received = 0
          if (item.filePath) await this.deletePartial(item)
        }
        this.applyProbe(item, r)
      }
      if (item.status !== 'starting') return
      const s = this.hooks.settings()
      if (!item.filePath) {
        let dir = item.dir
        if (s.categorizeFolders && item.dir === s.downloadDir && CATEGORY_FOLDERS[item.category])
          dir = path.join(item.dir, CATEGORY_FOLDERS[item.category])
        await mkdir(dir, { recursive: true })
        const taken = new Set(this.list().map((i) => i.filePath).filter(Boolean) as string[])
        item.filePath = await uniquePath(dir, item.fileName, taken)
        item.fileName = path.basename(item.filePath)
      } else await mkdir(path.dirname(item.filePath), { recursive: true })

      const part = this.partPath(item)
      let done: DoneSeg[] = []
      if (item.resumable && item.size !== null) {
        const state = await readJson<{ size?: number; done?: DoneSeg[] }>(`${part}.json`, {})
        const partExists = await stat(part).then(
          () => true,
          () => false
        )
        if (partExists && state.size === item.size && Array.isArray(state.done)) done = state.done
      }
      engine = new Engine({
        url: item.finalUrl ?? item.url,
        partPath: part,
        statePath: `${part}.json`,
        size: item.size,
        resumable: item.resumable,
        headers: this.headersFor(item),
        nets,
        streamsMode: item.streamsMode,
        global: this.global,
        done
      })
      this.engines.set(item.id, engine)
      this.lastNetBytes.set(item.id, {})
      item.status = 'downloading'
      item.startedAt ??= Date.now()
      this.touch(item)
      let last = performance.now()
      engine.on('progress', (snap: EngineSnapshot) => {
        const now = performance.now()
        if (item.status === 'downloading' || item.status === 'waiting') item.activeMs += now - last
        last = now
        const prev = this.lastNetBytes.get(item.id) ?? {}
        for (const [id, n] of Object.entries(snap.nets)) {
          this.nets.addUsage(id, n.bytes - (prev[id] ?? 0))
          prev[id] = n.bytes
        }
        this.lastNetBytes.set(item.id, prev)
        const merged = { ...item.nets }
        for (const [id, n] of Object.entries(snap.nets)) {
          const before = (item as unknown as { _base?: Record<string, number> })._base?.[id] ?? 0
          merged[id] = { bytes: before + n.bytes, speed: n.speed, streams: n.streams }
        }
        item.nets = merged
        item.received = snap.received
        if (item.size === null && engine?.size) item.size = engine.size
        item.speed = snap.speed
        item.peak = Math.max(item.peak, snap.speed)
        item.eta = item.size && snap.speed > 0 ? Math.round((item.size - snap.received) / snap.speed) : null
        if (snap.waiting && item.status === 'downloading') item.status = 'waiting'
        else if (!snap.waiting && item.status === 'waiting') item.status = 'downloading'
        this.touch(item)
      })
      ;(item as unknown as { _base?: Record<string, number> })._base = Object.fromEntries(
        Object.entries(item.nets).map(([k, v]) => [k, v.bytes])
      )
      this.starting.delete(item.id)
      const result = await engine.run()
      if (result === 'complete') await this.complete(item)
    } catch (error) {
      if (item.status === 'starting' || item.status === 'downloading' || item.status === 'waiting') {
        item.status = 'error'
        item.error = error instanceof EngineError ? error.code : (error as Error).message || 'unknown'
        if ((error as NodeJS.ErrnoException).code === 'ENOSPC') item.error = 'disk_full'
        if ((error as NodeJS.ErrnoException).code === 'EACCES') item.error = 'no_permission'
        this.emit('failed', item)
      }
    } finally {
      this.starting.delete(item.id)
      if (engine && this.engines.get(item.id) === engine) this.engines.delete(item.id)
      delete (item as unknown as { _base?: unknown })._base
      item.speed = 0
      item.eta = null
      for (const n of Object.values(item.nets)) {
        n.speed = 0
        n.streams = 0
      }
      this.touch(item)
      this.pump()
    }
  }

  private async complete(item: DownloadItem): Promise<void> {
    const part = this.partPath(item)
    let target = item.filePath!
    try {
      await stat(target)
      target = await uniquePath(path.dirname(target), path.basename(target))
    } catch {
      /* free */
    }
    await rename(part, target)
    item.filePath = target
    item.fileName = path.basename(target)
    item.status = 'completed'
    item.finishedAt = Date.now()
    if (item.size === null || item.size < item.received) item.size = item.received
    item.received = item.size
    this.touch(item)
    this.emit('completed', item)
  }

  private async deletePartial(item: DownloadItem): Promise<void> {
    if (!item.filePath) return
    const part = this.partPath(item)
    await rm(part, { force: true })
    await rm(`${part}.json`, { force: true })
  }

  // ---------- actions ----------

  private async halt(item: DownloadItem): Promise<void> {
    const engine = this.engines.get(item.id)
    if (engine) await engine.stop()
  }

  async action(id: string, action: DownloadAction): Promise<void> {
    const item = this.items.get(id)
    if (!item) return
    switch (action) {
      case 'pause':
        if (['queued', 'scheduled', 'starting', 'downloading', 'waiting'].includes(item.status)) {
          item.status = 'paused'
          this.touch(item)
          await this.halt(item)
        }
        break
      case 'resume':
      case 'retry':
        if (['paused', 'error', 'scheduled', 'waiting'].includes(item.status)) {
          item.status = 'queued'
          item.error = undefined
          this.touch(item)
          this.pump()
        }
        break
      case 'restart':
        item.status = 'paused'
        await this.halt(item)
        await this.deletePartial(item)
        Object.assign(item, { received: 0, nets: {}, peak: 0, activeMs: 0, probed: false, error: undefined })
        item.status = 'queued'
        this.touch(item)
        this.pump()
        break
      case 'cancel':
      case 'remove':
      case 'removeWithFile': {
        const wasDone = item.status === 'completed'
        item.status = 'paused'
        await this.halt(item)
        if (!wasDone || action === 'cancel') await this.deletePartial(item)
        if (action === 'removeWithFile' && wasDone && item.filePath)
          await this.hooks.trash(item.filePath).catch(() => unlink(item.filePath!).catch(() => undefined))
        this.items.delete(id)
        this.order = this.order.filter((x) => x !== id)
        this.emit('removed', [id])
        void this.save()
        this.pump()
        break
      }
      case 'open':
        if (item.filePath && item.status === 'completed') await this.hooks.openPath(item.filePath)
        break
      case 'folder':
        if (item.filePath)
          this.hooks.showInFolder(item.status === 'completed' ? item.filePath : this.partPath(item))
        else await this.hooks.openPath(item.dir)
        break
      case 'moveUp':
      case 'moveDown': {
        const i = this.order.indexOf(id)
        const j = action === 'moveUp' ? i - 1 : i + 1
        if (i < 0 || j < 0 || j >= this.order.length) break
        ;[this.order[i], this.order[j]] = [this.order[j], this.order[i]]
        this.emit('reordered')
        void this.save()
        break
      }
    }
  }

  async bulk(ids: string[], action: DownloadAction): Promise<void> {
    for (const id of ids) await this.action(id, action)
  }

  /** Swap an expired link for a fresh one without losing progress. */
  async replaceUrl(id: string, url: string): Promise<{ ok: boolean; error?: string }> {
    const item = this.items.get(id)
    if (!item) return { ok: false, error: 'not_found' }
    const route = this.nets.primaryRoute(item.networks)
    if (!route) return { ok: false, error: 'no_network' }
    const r = await probe(url, route, this.headersFor(item))
    if (!r.ok) return { ok: false, error: r.error }
    if (item.size !== null && r.size !== null && r.size !== item.size)
      return { ok: false, error: 'size_mismatch' }
    const wasRunning = this.engines.has(id)
    if (wasRunning) {
      item.status = 'paused'
      await this.halt(item)
    }
    item.url = url
    item.finalUrl = r.finalUrl
    item.resumable = r.resumable
    item.error = undefined
    item.status = 'queued'
    this.touch(item)
    this.pump()
    return { ok: true }
  }

  detail(id: string): DownloadDetail | null {
    const item = this.items.get(id)
    if (!item) return null
    const engine = this.engines.get(id)
    if (engine) return { id, size: item.size, segments: engine.segments(), history: engine.speedHistory() }
    const done = item.status === 'completed' && item.size
    return {
      id,
      size: item.size,
      segments: done ? [{ s: 0, e: item.size!, p: item.size!, n: null, active: false }] : [],
      history: []
    }
  }

  onSettingsChanged(patch: Partial<Settings>): void {
    if ('slowMode' in patch || 'slowLimit' in patch || 'globalLimit' in patch) this.applyLimits()
    if ('maxConcurrent' in patch || 'schedule' in patch) {
      this.checkSchedule()
      this.pump()
    }
    if ('disabledNets' in patch || 'netDailyCaps' in patch || 'netMonthlyCaps' in patch) {
      this.nets.rebuild()
      this.onTopology()
    }
  }
}

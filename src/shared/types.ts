export type ThemeId = 'nebula' | 'aurora' | 'royal' | 'pearl'
export type Lang = 'fa' | 'en'
export type NetKind = 'wifi' | 'ethernet' | 'cellular' | 'usb' | 'vpn' | 'other'
export type StreamsMode = 'auto' | number

export interface NetAddress {
  address: string
  family: 4 | 6
}

export interface NetworkUsage {
  today: number
  month: number
}

export interface NetworkInfo {
  id: string
  device: string
  name: string
  hardware: string
  kind: NetKind
  addresses: NetAddress[]
  color: string
  enabled: boolean
  latency: number | null
  online: boolean | null
  limit: number
  dailyCap: number
  monthlyCap: number
  usage: NetworkUsage
  capped: boolean
  speed: number
}

export type DownloadStatus =
  | 'queued'
  | 'starting'
  | 'downloading'
  | 'paused'
  | 'waiting'
  | 'scheduled'
  | 'completed'
  | 'error'

export type Category = 'video' | 'audio' | 'archive' | 'document' | 'program' | 'image' | 'other'

export interface NetStat {
  bytes: number
  speed: number
  streams: number
}

export interface DownloadItem {
  id: string
  url: string
  finalUrl?: string
  fileName: string
  dir: string
  filePath?: string
  size: number | null
  received: number
  status: DownloadStatus
  error?: string
  resumable: boolean
  createdAt: number
  startedAt?: number
  finishedAt?: number
  category: Category
  networks: string[] | null
  streamsMode: StreamsMode
  headers?: Record<string, string>
  referrer?: string
  speed: number
  peak: number
  eta: number | null
  activeMs: number
  nets: Record<string, NetStat>
  etag?: string
  lastModified?: string
  probed?: boolean
  userFileName?: boolean
}

export interface SegmentView {
  s: number
  e: number
  p: number
  n: string | null
  active: boolean
}

export interface SpeedSample {
  t: number
  total: number
  nets: Record<string, number>
}

export interface DownloadDetail {
  id: string
  size: number | null
  segments: SegmentView[]
  history: SpeedSample[]
}

export interface Schedule {
  enabled: boolean
  start: string
  end: string
  days: number[]
}

export interface Settings {
  language: Lang
  theme: ThemeId
  downloadDir: string
  maxConcurrent: number
  streamsMode: StreamsMode
  globalLimit: number
  slowMode: boolean
  slowLimit: number
  speedUnit: 'bytes' | 'bits'
  netNames: Record<string, string>
  netColors: Record<string, string>
  netLimits: Record<string, number>
  netDailyCaps: Record<string, number>
  netMonthlyCaps: Record<string, number>
  disabledNets: string[]
  schedule: Schedule
  bridgeEnabled: boolean
  bridgePort: number
  askBeforeBridge: boolean
  clipboardWatch: boolean
  notifications: boolean
  autoUpdate: boolean
  closeToTray: boolean
  preventSleep: boolean
  categorizeFolders: boolean
  onboarded: boolean
}

export type ProbeResult =
  | {
      ok: true
      url: string
      finalUrl: string
      fileName: string
      size: number | null
      resumable: boolean
      contentType: string | null
      etag?: string
      lastModified?: string
    }
  | { ok: false; error: string }

export interface NewDownloadRequest {
  urls: string[]
  dir?: string
  fileName?: string
  networks?: string[] | null
  streamsMode?: StreamsMode
  start: boolean
  headers?: Record<string, string>
  referrer?: string
}

export type DownloadAction =
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'remove'
  | 'removeWithFile'
  | 'retry'
  | 'restart'
  | 'open'
  | 'folder'
  | 'moveUp'
  | 'moveDown'

export interface AppInfo {
  version: string
  platform: string
  arch: string
  bindingOk: boolean
  electron: string
}

export interface UpdateState {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'none' | 'error'
  version?: string
  percent?: number
  error?: string
}

export interface IncomingLink {
  url: string
  fileName?: string
  size?: number
  headers?: Record<string, string>
  referrer?: string
  source: 'browser' | 'clipboard' | 'cli'
}

export interface Toast {
  kind: 'info' | 'success' | 'error'
  key: string
  vars?: Record<string, string | number>
}

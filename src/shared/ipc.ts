import type {
  AppInfo,
  DownloadAction,
  DownloadDetail,
  DownloadItem,
  IncomingLink,
  NetworkInfo,
  NewDownloadRequest,
  ProbeResult,
  Settings,
  Toast,
  UpdateState
} from './types'

export interface SabiEvents {
  downloads: DownloadItem[]
  removed: string[]
  networks: NetworkInfo[]
  settings: Settings
  incoming: IncomingLink
  update: UpdateState
  toast: Toast
}

export interface SabiApi {
  getInfo(): Promise<AppInfo>
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  listNetworks(): Promise<NetworkInfo[]>
  refreshNetworks(): Promise<NetworkInfo[]>
  listDownloads(): Promise<DownloadItem[]>
  getDetail(id: string): Promise<DownloadDetail | null>
  probe(url: string, headers?: Record<string, string>): Promise<ProbeResult>
  add(req: NewDownloadRequest): Promise<string[]>
  action(id: string, action: DownloadAction): Promise<void>
  bulk(ids: string[], action: DownloadAction): Promise<void>
  replaceUrl(id: string, url: string): Promise<{ ok: boolean; error?: string }>
  chooseFolder(current?: string): Promise<string | null>
  openExternal(url: string): Promise<void>
  diskFree(dir?: string): Promise<number | null>
  checkUpdate(): Promise<void>
  installUpdate(): Promise<void>
  setTitleBar(color: string, symbolColor: string): void
  readClipboard(): Promise<string>
  on<K extends keyof SabiEvents>(event: K, cb: (payload: SabiEvents[K]) => void): () => void
}

export const INVOKE_CHANNELS = [
  'getInfo',
  'getSettings',
  'setSettings',
  'listNetworks',
  'refreshNetworks',
  'listDownloads',
  'getDetail',
  'probe',
  'add',
  'action',
  'bulk',
  'replaceUrl',
  'chooseFolder',
  'openExternal',
  'diskFree',
  'checkUpdate',
  'installUpdate',
  'readClipboard'
] as const

export type InvokeChannel = (typeof INVOKE_CHANNELS)[number]

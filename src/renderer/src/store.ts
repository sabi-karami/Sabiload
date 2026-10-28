import { create } from 'zustand'
import type {
  AppInfo,
  Category,
  DownloadItem,
  IncomingLink,
  NetworkInfo,
  Settings,
  UpdateState
} from '../../shared/types'

export type View =
  | 'all'
  | 'active'
  | 'queued'
  | 'completed'
  | 'failed'
  | Category
  | 'networks'
  | 'settings'
  | 'about'

export interface ToastItem {
  id: number
  kind: 'info' | 'success' | 'error' | 'link'
  text: string
  link?: IncomingLink
}

interface State {
  ready: boolean
  info: AppInfo | null
  settings: Settings | null
  networks: NetworkInfo[]
  downloads: DownloadItem[]
  view: View
  search: string
  selected: string[]
  detailId: string | null
  dialog: { open: boolean; prefill?: IncomingLink }
  toasts: ToastItem[]
  update: UpdateState
  setView: (v: View) => void
  setSearch: (s: string) => void
  toggleSelect: (id: string, additive?: boolean) => void
  setSelected: (ids: string[]) => void
  openDetail: (id: string | null) => void
  openDialog: (prefill?: IncomingLink) => void
  closeDialog: () => void
  toast: (t: Omit<ToastItem, 'id'>) => void
  dismissToast: (id: number) => void
  patchSettings: (p: Partial<Settings>) => Promise<void>
}

let toastId = 1

export const useStore = create<State>((set, get) => ({
  ready: false,
  info: null,
  settings: null,
  networks: [],
  downloads: [],
  view: 'all',
  search: '',
  selected: [],
  detailId: null,
  dialog: { open: false },
  toasts: [],
  update: { state: 'idle' },
  setView: (view) => set({ view, selected: [] }),
  setSearch: (search) => set({ search }),
  toggleSelect: (id, additive = true) => {
    const cur = get().selected
    if (!additive) return set({ selected: cur.length === 1 && cur[0] === id ? [] : [id] })
    set({ selected: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  },
  setSelected: (selected) => set({ selected }),
  openDetail: (detailId) => set({ detailId }),
  openDialog: (prefill) => set({ dialog: { open: true, prefill } }),
  closeDialog: () => set({ dialog: { open: false } }),
  toast: (t) => {
    const id = toastId++
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] })
    if (t.kind !== 'link') setTimeout(() => get().dismissToast(id), 4200)
    else setTimeout(() => get().dismissToast(id), 12_000)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  patchSettings: async (p) => {
    const cur = get().settings
    if (cur) set({ settings: { ...cur, ...p } })
    const next = await window.sabi.setSettings(p)
    set({ settings: next })
  }
}))

export async function bootstrap(): Promise<void> {
  const api = window.sabi
  const [info, settings, networks, downloads] = await Promise.all([
    api.getInfo(),
    api.getSettings(),
    api.listNetworks(),
    api.listDownloads()
  ])
  useStore.setState({ info, settings, networks, downloads, ready: true })
  api.on('downloads', (changed) => {
    const map = new Map(useStore.getState().downloads.map((d) => [d.id, d]))
    const fresh: DownloadItem[] = []
    for (const c of changed) {
      if (!map.has(c.id)) fresh.push(c)
      map.set(c.id, c)
    }
    const order = useStore.getState().downloads.map((d) => d.id)
    const list = [...fresh, ...order.map((id) => map.get(id)!).filter(Boolean)]
    useStore.setState({ downloads: list })
  })
  api.on('removed', (ids) => {
    const s = useStore.getState()
    useStore.setState({
      downloads: s.downloads.filter((d) => !ids.includes(d.id)),
      selected: s.selected.filter((x) => !ids.includes(x)),
      detailId: s.detailId && ids.includes(s.detailId) ? null : s.detailId
    })
  })
  api.on('networks', (networks) => useStore.setState({ networks }))
  api.on('settings', (settings) => useStore.setState({ settings }))
  api.on('update', (update) => useStore.setState({ update }))
  api.on('incoming', (link) => {
    if (link.source === 'clipboard') {
      useStore.getState().toast({ kind: 'link', text: link.url, link })
      return
    }
    useStore.getState().openDialog(link.url ? link : undefined)
  })
}

/** Re-sync the full list (after reordering, for example). */
export async function reloadDownloads(): Promise<void> {
  useStore.setState({ downloads: await window.sabi.listDownloads() })
}

// Handy for the web demo and for debugging from DevTools.
;(window as unknown as { __sabiStore?: typeof useStore }).__sabiStore = useStore

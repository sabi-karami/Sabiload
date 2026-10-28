import { useEffect, useMemo } from 'react'
import { bootstrap, useStore } from './store'
import { useT } from './useT'
import { THEMES } from './themes'
import type { TKey } from './i18n'
import { Backdrop } from './components/Backdrop'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { Hero } from './components/Hero'
import { DownloadList } from './components/DownloadList'
import { NewDownloadDialog } from './components/NewDownloadDialog'
import { DetailDrawer } from './components/DetailDrawer'
import { Toasts } from './components/Toasts'
import { StatusBar } from './components/StatusBar'
import { Onboarding } from './components/Onboarding'
import { NetworksScreen } from './screens/NetworksScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { AboutScreen } from './screens/AboutScreen'
import { Logo } from './components/Logo'

function DownloadsView(): React.JSX.Element {
  const t = useT()
  const view = useStore((s) => s.view)
  const search = useStore((s) => s.search.trim().toLowerCase())
  const downloads = useStore((s) => s.downloads)
  const items = useMemo(() => {
    let list = downloads
    switch (view) {
      case 'all':
        break
      case 'active':
        list = list.filter((d) => ['downloading', 'starting', 'waiting'].includes(d.status))
        break
      case 'queued':
        list = list.filter((d) => ['queued', 'scheduled', 'paused'].includes(d.status))
        break
      case 'completed':
        list = list.filter((d) => d.status === 'completed')
        break
      case 'failed':
        list = list.filter((d) => d.status === 'error')
        break
      default:
        list = list.filter((d) => d.category === view)
    }
    if (search) list = list.filter((d) => d.fileName.toLowerCase().includes(search) || d.url.toLowerCase().includes(search))
    return list
  }, [downloads, view, search])
  const title = view === 'queued' ? t('queued') : t(view as TKey)
  return (
    <>
      <Hero />
      <div className="toolbar">
        <h2>{title}</h2>
      </div>
      <DownloadList items={items} />
    </>
  )
}

export default function App(): React.JSX.Element {
  const ready = useStore((s) => s.ready)
  const settings = useStore((s) => s.settings)
  const info = useStore((s) => s.info)
  const view = useStore((s) => s.view)

  useEffect(() => {
    void bootstrap()
  }, [])

  useEffect(() => {
    if (!settings) return
    const root = document.documentElement
    root.dataset.theme = settings.theme
    root.lang = settings.language
    root.dir = settings.language === 'fa' ? 'rtl' : 'ltr'
    const th = THEMES.find((x) => x.id === settings.theme)
    if (th) window.sabi.setTitleBar(th.bar, th.symbol)
  }, [settings?.theme, settings?.language])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const mod = e.ctrlKey || e.metaKey
      const st = useStore.getState()
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        st.openDialog()
      } else if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.searchbox input')?.focus()
      } else if (mod && e.key.toLowerCase() === 'a' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        st.setSelected(st.downloads.map((d) => d.id))
      } else if (e.key === 'Delete' && st.selected.length && !(e.target instanceof HTMLInputElement)) {
        void window.sabi.bulk(st.selected, 'remove')
      }
    }
    const onPaste = (e: ClipboardEvent): void => {
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      const text = e.clipboardData?.getData('text')?.trim()
      if (text && /^https?:\/\//i.test(text)) useStore.getState().openDialog({ url: text, source: 'cli' })
    }
    const onDrop = (e: DragEvent): void => {
      e.preventDefault()
      const text = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text')
      if (text && /^https?:\/\//i.test(text.trim())) useStore.getState().openDialog({ url: text.trim().split('\n')[0], source: 'cli' })
    }
    const onDragOver = (e: DragEvent): void => e.preventDefault()
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragover', onDragOver)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragover', onDragOver)
    }
  }, [])

  if (!ready || !settings)
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <Backdrop />
        <div style={{ position: 'relative', animation: 'float 2s ease-in-out infinite' }}>
          <Logo size={84} />
        </div>
      </div>
    )

  const platform = info?.platform === 'darwin' ? 'mac' : info?.platform === 'win32' ? 'win' : 'linux'
  return (
    <>
      <Backdrop />
      <div className={`app ${platform}`}>
        <Sidebar />
        <main className="main">
          <TopBar />
          <div className="content">
            {view === 'networks' ? <NetworksScreen /> : view === 'settings' ? <SettingsScreen /> : view === 'about' ? <AboutScreen /> : <DownloadsView />}
          </div>
          <StatusBar />
        </main>
      </div>
      <NewDownloadDialog />
      <DetailDrawer />
      <Toasts />
      <Onboarding />
    </>
  )
}

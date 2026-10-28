import { Pause, Play, Plus, Search, Turtle } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../useT'

export function TopBar(): React.JSX.Element {
  const t = useT()
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const settings = useStore((s) => s.settings)
  const patch = useStore((s) => s.patchSettings)
  const openDialog = useStore((s) => s.openDialog)
  const downloads = useStore((s) => s.downloads)
  const anyActive = downloads.some((d) => ['downloading', 'starting', 'waiting', 'queued', 'scheduled'].includes(d.status))
  const anyPaused = downloads.some((d) => d.status === 'paused' || d.status === 'error')

  return (
    <header className="topbar drag">
      <div className="searchbox nodrag">
        <Search size={16} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} />
        <kbd>Ctrl F</kbd>
      </div>
      <div className="spacer" style={{ flex: 1 }} />
      <button
        className={`btn ${settings?.slowMode ? 'on' : ''}`}
        title={t('slowModeHint')}
        onClick={() => void patch({ slowMode: !settings?.slowMode })}
      >
        <Turtle size={16} />
        {t('slowMode')}
      </button>
      {anyActive ? (
        <button className="btn icon" title={t('pauseAll')} onClick={() => void window.sabi.bulk(downloads.map((d) => d.id), 'pause')}>
          <Pause size={16} />
        </button>
      ) : (
        <button className="btn icon" title={t('resumeAll')} disabled={!anyPaused} onClick={() => void window.sabi.bulk(downloads.map((d) => d.id), 'resume')}>
          <Play size={16} />
        </button>
      )}
      <button className="btn primary" onClick={() => openDialog()}>
        <Plus size={17} />
        {t('newDownload')}
        <kbd>Ctrl N</kbd>
      </button>
    </header>
  )
}

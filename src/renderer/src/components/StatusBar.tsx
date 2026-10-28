import { useEffect, useState } from 'react'
import { ArrowDown, CalendarClock, HardDrive, Network, RefreshCw, Turtle } from 'lucide-react'
import { scheduleAllows } from '../../../shared/schedule'
import { useStore } from '../store'
import { useLang, useT } from '../useT'
import { bytes, num, speed } from '../format'

export function StatusBar(): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const downloads = useStore((s) => s.downloads)
  const networks = useStore((s) => s.networks)
  const s = useStore((st) => st.settings)
  const update = useStore((st) => st.update)
  const setView = useStore((st) => st.setView)
  const [free, setFree] = useState<number | null>(null)
  useEffect(() => {
    const load = (): void => void window.sabi.diskFree().then(setFree)
    load()
    const iv = setInterval(load, 15_000)
    return () => clearInterval(iv)
  }, [s?.downloadDir])
  const total = downloads.reduce((a, d) => a + (d.status === 'downloading' ? d.speed : 0), 0)
  const active = downloads.filter((d) => ['downloading', 'starting', 'waiting'].includes(d.status)).length
  const queued = downloads.filter((d) => d.status === 'queued' || d.status === 'scheduled').length
  const blocked = s ? !scheduleAllows(s.schedule) : false
  return (
    <footer className="statusbar">
      <span>
        <ArrowDown size={13} /> <b className="num">{speed(lang, total, s?.speedUnit)}</b>
      </span>
      <span className="sep" />
      <span className="num">
        {t('activeCount', { n: num(lang, active) })} · {t('queued')} {num(lang, queued)}
      </span>
      <span className="sep" />
      <span>
        <Network size={13} /> {num(lang, networks.filter((n) => n.enabled && !n.capped).length)}/{num(lang, networks.length)}
      </span>
      {s?.slowMode && (
        <>
          <span className="sep" />
          <span style={{ color: 'var(--warn)' }}>
            <Turtle size={13} /> {t('slowMode')}
          </span>
        </>
      )}
      {blocked && s && (
        <>
          <span className="sep" />
          <span style={{ color: 'var(--accent2)' }}>
            <CalendarClock size={13} /> {t('scheduleBanner', { t: s.schedule.start })}
          </span>
        </>
      )}
      <div style={{ flex: 1 }} />
      {(update.state === 'ready' || update.state === 'available' || update.state === 'downloading') && (
        <button className="btn sm on" onClick={() => (update.state === 'downloading' ? setView('settings') : void window.sabi.installUpdate())}>
          <RefreshCw size={13} />
          {update.state === 'downloading'
            ? t('upd_downloading', { p: num(lang, update.percent ?? 0) })
            : update.state === 'ready'
              ? t('upd_ready', { v: update.version ?? '' })
              : t('upd_available', { v: update.version ?? '' })}
        </button>
      )}
      {free !== null && (
        <span className="num">
          <HardDrive size={13} /> {t('freeSpace', { s: bytes(lang, free) })}
        </span>
      )}
    </footer>
  )
}

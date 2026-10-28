import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Link, Pause, Play, RotateCcw, X } from 'lucide-react'
import type { DownloadDetail } from '../../../shared/types'
import { useStore } from '../store'
import { useLang, useT } from '../useT'
import { bytes, duration, num, percent, speed } from '../format'
import { errorText, type TKey } from '../i18n'
import { CATEGORY_COLOR, CATEGORY_ICON, NET_ICON } from './icons'
import { Sparkline } from './Sparkline'
import { runAction } from './DownloadList'

const CELLS = 400

/** Paint the file as a grid of squares, each colored by whoever fetched it. */
function BlockGrid({ detail, colors }: { detail: DownloadDetail; colors: Record<string, string> }): React.JSX.Element {
  const cells = useMemo(() => {
    const size = detail.size ?? 0
    const out: { c: string | null; a: boolean; f: number }[] = Array.from({ length: CELLS }, () => ({ c: null, a: false, f: 0 }))
    if (!size) return out
    const per = size / CELLS
    for (const seg of detail.segments) {
      const color = seg.n ? (colors[seg.n] ?? 'var(--accent)') : 'var(--accent)'
      const from = Math.floor(seg.s / per)
      const to = Math.min(CELLS - 1, Math.floor((Math.max(seg.p, seg.s + 1) - 1) / per))
      for (let i = from; i <= to; i++) {
        const cellStart = i * per
        const cellEnd = cellStart + per
        const covered = Math.max(0, Math.min(cellEnd, seg.p) - Math.max(cellStart, seg.s))
        out[i].f += covered / per
        if (covered > 0) out[i].c = color
        if (seg.active && seg.p >= cellStart && seg.p <= cellEnd) out[i].a = true
      }
    }
    return out
  }, [detail, colors])
  return (
    <div className="blockgrid">
      {cells.map((c, i) => (
        <i
          key={i}
          className={c.a ? 'act' : ''}
          style={
            c.c
              ? { background: c.c, opacity: 0.35 + Math.min(1, c.f) * 0.65, boxShadow: c.a ? `0 0 8px ${c.c}` : undefined }
              : c.a
                ? { outline: '1px solid var(--accent)' }
                : undefined
          }
        />
      ))}
    </div>
  )
}

export function DetailDrawer(): React.JSX.Element | null {
  const t = useT()
  const lang = useLang()
  const id = useStore((s) => s.detailId)
  const close = () => useStore.getState().openDetail(null)
  const item = useStore((s) => s.downloads.find((d) => d.id === id))
  const networks = useStore((s) => s.networks)
  const unit = useStore((s) => s.settings?.speedUnit ?? 'bytes')
  const toast = useStore((s) => s.toast)
  const [detail, setDetail] = useState<DownloadDetail | null>(null)
  const [newUrl, setNewUrl] = useState('')

  useEffect(() => {
    if (!id) return
    setNewUrl('')
    let live = true
    const load = (): void => {
      void window.sabi.getDetail(id).then((d) => live && setDetail(d))
    }
    load()
    const iv = setInterval(load, 700)
    return () => {
      live = false
      clearInterval(iv)
    }
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') useStore.getState().openDetail(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!id || !item) return null
  const colors = Object.fromEntries(networks.map((n) => [n.id, n.color]))
  const Icon = CATEGORY_ICON[item.category]
  const p = item.size ? item.received / item.size : 0
  const avg = item.activeMs > 1000 ? item.received / (item.activeMs / 1000) : 0
  const netTotal = Object.values(item.nets).reduce((s, n) => s + n.bytes, 0) || 1
  const running = ['downloading', 'starting', 'waiting', 'queued', 'scheduled'].includes(item.status)

  return (
    <>
      <div className="drawer-scrim" onClick={close} />
      <aside className="drawer glass">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div className="fileicon" style={{ '--c': CATEGORY_COLOR[item.category], width: 54, height: 54 } as React.CSSProperties}>
            <Icon size={26} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="fname" style={{ fontSize: 16 }} title={item.fileName}>
              {item.fileName}
            </div>
            <span className={`status-badge st-${item.status}`}>{t(`status_${item.status}` as TKey)}</span>
          </div>
          <button className="btn sm icon ghost" onClick={close}>
            <X size={17} />
          </button>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="num" style={{ fontSize: 30, fontWeight: 800 }}>
              {item.size ? percent(lang, item.status === 'completed' ? 1 : p) : bytes(lang, item.received)}
            </span>
            <span className="num muted">
              {bytes(lang, item.received)} / {bytes(lang, item.size)}
            </span>
          </div>
          <div className={`bar ${item.status === 'downloading' ? 'live' : ''}`} style={{ height: 10 }}>
            <div className="fill" style={{ width: `${(item.status === 'completed' ? 1 : p) * 100}%` }}>
              <span style={{ flex: 1, background: 'var(--grad)' }} />
            </div>
          </div>
          {item.status === 'error' && (
            <div className="banner" style={{ marginTop: 10 }}>
              {errorText(lang, item.error)}
            </div>
          )}
        </div>

        <div className="stats">
          <div className="stat">
            <div className="k">{t('speed')}</div>
            <div className="v num">{speed(lang, item.speed, unit)}</div>
          </div>
          <div className="stat">
            <div className="k">{t('eta')}</div>
            <div className="v num">{duration(lang, item.eta)}</div>
          </div>
          <div className="stat">
            <div className="k">{t('peak')}</div>
            <div className="v num">{speed(lang, item.peak, unit)}</div>
          </div>
          <div className="stat">
            <div className="k">{t('average')}</div>
            <div className="v num">{speed(lang, avg, unit)}</div>
          </div>
          <div className="stat">
            <div className="k">{t('elapsed')}</div>
            <div className="v num">{duration(lang, item.activeMs / 1000)}</div>
          </div>
          <div className="stat">
            <div className="k">{t('resumable')}</div>
            <div className="v">{item.resumable ? t('yes') : t('no')}</div>
          </div>
        </div>

        {detail && detail.history.length > 1 && (
          <div className="card glass">
            <h3>{t('throughput')}</h3>
            <Sparkline samples={detail.history} colors={colors} stacked height={110} window={120} />
          </div>
        )}

        {Object.keys(item.nets).length > 0 && (
          <div className="card glass">
            <h3>{t('perNetwork')}</h3>
            {Object.entries(item.nets).map(([nid, n]) => {
              const net = networks.find((x) => x.id === nid)
              const NIcon = NET_ICON[net?.kind ?? 'other']
              const share = n.bytes / netTotal
              return (
                <div key={nid} className="share-row">
                  <span className="sw" style={{ background: net?.color ?? 'var(--accent)' }} />
                  <NIcon size={15} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{net?.name ?? nid}</span>
                  {n.streams > 0 && (
                    <span className="faint num">
                      {num(lang, n.streams)} {t('streams')}
                    </span>
                  )}
                  <span className="num" style={{ width: 92, textAlign: 'end' }}>
                    {speed(lang, n.speed, unit)}
                  </span>
                  <span className="num muted" style={{ width: 70, textAlign: 'end' }}>
                    {percent(lang, share)}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {detail && item.size && item.resumable && (
          <div className="card glass">
            <h3 title={t('blockMapHint')}>{t('blockMap')}</h3>
            <BlockGrid detail={detail} colors={colors} />
            <div className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>
              {t('blockMapHint')}
            </div>
          </div>
        )}

        <div className="card glass">
          <h3>{t('link')}</h3>
          <div className="mono ltr faint" style={{ fontSize: 11.5, wordBreak: 'break-all', userSelect: 'text' }}>
            {item.url}
          </div>
          {item.status !== 'completed' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input className="input ltr" placeholder={t('newLinkPlaceholder')} value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <button
                className="btn"
                disabled={!/^https?:\/\//.test(newUrl)}
                onClick={async () => {
                  const r = await window.sabi.replaceUrl(item.id, newUrl.trim())
                  if (r.ok) {
                    toast({ kind: 'success', text: t('linkReplaced') })
                    setNewUrl('')
                  } else toast({ kind: 'error', text: errorText(lang, r.error) })
                }}
              >
                <Link size={15} />
                {t('replaceLink')}
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          {item.status === 'completed' ? (
            <>
              <button className="btn primary" onClick={() => void runAction(item.id, 'open')}>
                {t('open')}
              </button>
              <button className="btn" onClick={() => void runAction(item.id, 'folder')}>
                <FolderOpen size={15} />
                {t('showInFolder')}
              </button>
            </>
          ) : running ? (
            <button className="btn" onClick={() => void runAction(item.id, 'pause')}>
              <Pause size={15} />
              {t('pause')}
            </button>
          ) : (
            <button className="btn primary" onClick={() => void runAction(item.id, 'resume')}>
              {item.status === 'error' ? <RotateCcw size={15} /> : <Play size={15} />}
              {item.status === 'error' ? t('retry') : t('resume')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn danger" onClick={() => void runAction(item.id, item.status === 'completed' ? 'remove' : 'cancel')}>
            <X size={15} />
            {item.status === 'completed' ? t('remove') : t('cancel')}
          </button>
        </div>
      </aside>
    </>
  )
}

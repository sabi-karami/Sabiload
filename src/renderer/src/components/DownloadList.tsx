import { memo, useCallback, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  FolderOpen,
  Inbox,
  Link,
  MoreVertical,
  Pause,
  Play,
  RotateCcw,
  SquareCheck,
  Trash2,
  X
} from 'lucide-react'
import type { DownloadAction, DownloadItem, NetworkInfo } from '../../../shared/types'
import { reloadDownloads, useStore } from '../store'
import { useLang, useT } from '../useT'
import { bytes, duration, num, percent, speed } from '../format'
import { errorText, type TKey } from '../i18n'
import { CATEGORY_COLOR, CATEGORY_ICON } from './icons'
import { Menu, type MenuItem } from './Menu'

const RUNNING = ['downloading', 'starting', 'waiting']

export async function runAction(id: string, action: DownloadAction): Promise<void> {
  await window.sabi.action(id, action)
  if (action === 'moveUp' || action === 'moveDown') await reloadDownloads()
}

export function useItemMenu(): {
  menu: React.JSX.Element | null
  open: (e: React.MouseEvent, item: DownloadItem) => void
} {
  const t = useT()
  const toast = useStore((s) => s.toast)
  const openDetail = useStore((s) => s.openDetail)
  const selected = useStore((s) => s.selected)
  const [state, setState] = useState<{ x: number; y: number; item: DownloadItem } | null>(null)
  const close = useCallback(() => setState(null), [])
  const open = useCallback((e: React.MouseEvent, item: DownloadItem) => {
    e.preventDefault()
    e.stopPropagation()
    setState({ x: e.clientX, y: e.clientY, item })
  }, [])
  let menu: React.JSX.Element | null = null
  if (state) {
    const it = state.item
    const multi = selected.length > 1 && selected.includes(it.id)
    const act = (a: DownloadAction): (() => void) =>
      multi ? () => void window.sabi.bulk(selected, a) : () => void runAction(it.id, a)
    const running = RUNNING.includes(it.status) || it.status === 'queued' || it.status === 'scheduled'
    const items: MenuItem[] = []
    if (it.status === 'completed') {
      items.push({ label: t('open'), icon: FolderOpen, onClick: act('open') })
      items.push({ label: t('showInFolder'), icon: FolderOpen, onClick: act('folder') })
    } else if (running) items.push({ label: t('pause'), icon: Pause, onClick: act('pause') })
    else items.push({ label: it.status === 'error' ? t('retry') : t('resume'), icon: Play, onClick: act('resume') })
    if (it.status !== 'completed') {
      items.push({ label: t('details'), icon: SquareCheck, onClick: () => openDetail(it.id) })
      items.push({ label: t('replaceLink'), icon: Link, onClick: () => openDetail(it.id) })
    }
    items.push({
      label: t('copyLink'),
      icon: Copy,
      onClick: () => {
        void navigator.clipboard.writeText(it.url)
        toast({ kind: 'success', text: t('copied') })
      }
    })
    if (['queued', 'scheduled', 'paused'].includes(it.status) && !multi) {
      items.push({ divider: true, label: '' })
      items.push({ label: t('moveUp'), icon: ArrowUp, onClick: act('moveUp') })
      items.push({ label: t('moveDown'), icon: ArrowDown, onClick: act('moveDown') })
    }
    items.push({ divider: true, label: '' })
    items.push({ label: t('restart'), icon: RotateCcw, onClick: act('restart'), disabled: it.status === 'completed' })
    items.push({ label: it.status === 'completed' ? t('remove') : t('cancel'), icon: X, onClick: act(it.status === 'completed' ? 'remove' : 'cancel') })
    if (it.status === 'completed') items.push({ label: t('removeWithFile'), icon: Trash2, danger: true, onClick: act('removeWithFile') })
    menu = <Menu x={state.x} y={state.y} items={items} onClose={close} />
  }
  return { menu, open }
}

function Progress({ item, nets }: { item: DownloadItem; nets: NetworkInfo[] }): React.JSX.Element {
  const p = item.size ? Math.min(1, item.received / item.size) : item.status === 'completed' ? 1 : 0
  const live = item.status === 'downloading'
  const total = Object.values(item.nets).reduce((s, n) => s + n.bytes, 0) || 1
  const parts = Object.entries(item.nets).filter(([, n]) => n.bytes > 0)
  return (
    <div className={`bar ${live ? 'live' : ''} ${item.status === 'completed' ? 'done' : ''} ${item.status === 'error' ? 'err' : ''}`}>
      <div className="fill" style={{ width: `${p * 100}%` }}>
        {parts.length && item.status !== 'completed' ? (
          parts.map(([id, n]) => (
            <span key={id} style={{ flex: n.bytes / total, background: nets.find((x) => x.id === id)?.color ?? 'var(--accent)' }} />
          ))
        ) : (
          <span style={{ flex: 1, background: 'var(--grad)' }} />
        )}
      </div>
    </div>
  )
}

const Row = memo(function Row({
  item,
  nets,
  selected,
  onMenu
}: {
  item: DownloadItem
  nets: NetworkInfo[]
  selected: boolean
  onMenu: (e: React.MouseEvent, item: DownloadItem) => void
}): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const unit = useStore((s) => s.settings?.speedUnit ?? 'bytes')
  const toggle = useStore((s) => s.toggleSelect)
  const openDetail = useStore((s) => s.openDetail)
  const Icon = CATEGORY_ICON[item.category]
  const color = CATEGORY_COLOR[item.category]
  const p = item.size ? item.received / item.size : 0
  const running = RUNNING.includes(item.status)
  const activeStreams = Object.values(item.nets).reduce((s, n) => s + n.streams, 0)
  const usedNets = Object.entries(item.nets).filter(([, n]) => n.speed > 0 || n.streams > 0)

  return (
    <div
      className={`row ${selected ? 'sel' : ''} st-${item.status}`}
      onClick={(e) => (e.ctrlKey || e.metaKey ? toggle(item.id) : openDetail(item.id))}
      onDoubleClick={() => item.status === 'completed' && void runAction(item.id, 'open')}
      onContextMenu={(e) => onMenu(e, item)}
    >
      <button
        className={`check ${selected ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          toggle(item.id)
        }}
        aria-label="select"
      >
        {selected && <Check size={13} strokeWidth={3} />}
      </button>
      <div className="fileicon" style={{ '--c': color } as React.CSSProperties}>
        <Icon size={22} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="fname" title={item.fileName}>
          {item.fileName}
        </div>
        <div className="fsub">
          <span className={`status-badge st-${item.status}`}>{t(`status_${item.status}` as TKey)}</span>
          <span className="num">
            {item.size ? `${bytes(lang, item.received)} ${t('of')} ${bytes(lang, item.size)}` : item.received ? bytes(lang, item.received) : t('unknownSize')}
          </span>
          {item.status === 'error' && <span style={{ color: 'var(--bad)' }}>{errorText(lang, item.error)}</span>}
          {running && activeStreams > 0 && (
            <span className="num faint">
              {num(lang, activeStreams)} {t('streams')}
            </span>
          )}
        </div>
        <Progress item={item} nets={nets} />
      </div>
      <div className="rowmid">
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {usedNets.map(([id]) => {
            const n = nets.find((x) => x.id === id)
            return n ? <span key={id} className="dot-lg" title={n.name} style={{ background: n.color, boxShadow: `0 0 10px ${n.color}` }} /> : null
          })}
        </div>
        <div className="num faint" style={{ fontSize: 12, marginTop: 4 }}>
          {item.size && item.status !== 'completed' ? percent(lang, p) : ''}
        </div>
      </div>
      <div className="rowspeed">
        {item.status === 'downloading' ? (
          <>
            <div className="big num">{speed(lang, item.speed, unit)}</div>
            <div className="small num">
              {duration(lang, item.eta)} {t('left')}
            </div>
          </>
        ) : item.status === 'completed' ? (
          <div className="small num">{bytes(lang, item.size)}</div>
        ) : null}
      </div>
      <div className="rowactions" onClick={(e) => e.stopPropagation()}>
        {item.status === 'completed' ? (
          <button className="btn sm icon ghost" title={t('showInFolder')} onClick={() => void runAction(item.id, 'folder')}>
            <FolderOpen size={16} />
          </button>
        ) : running || item.status === 'queued' || item.status === 'scheduled' ? (
          <button className="btn sm icon ghost" title={t('pause')} onClick={() => void runAction(item.id, 'pause')}>
            <Pause size={16} />
          </button>
        ) : (
          <button className="btn sm icon ghost" title={t('resume')} onClick={() => void runAction(item.id, 'resume')}>
            {item.status === 'error' ? <RotateCcw size={16} /> : <Play size={16} />}
          </button>
        )}
        <button className="btn sm icon ghost" onClick={(e) => onMenu(e, item)}>
          <MoreVertical size={16} />
        </button>
      </div>
    </div>
  )
})

export function DownloadList({ items }: { items: DownloadItem[] }): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const nets = useStore((s) => s.networks)
  const selected = useStore((s) => s.selected)
  const setSelected = useStore((s) => s.setSelected)
  const { menu, open } = useItemMenu()

  if (!items.length)
    return (
      <div className="empty">
        <div className="empty-art">
          <Inbox size={44} />
        </div>
        <h3>{t('emptyTitle')}</h3>
        <div className="muted">{t('emptySub')}</div>
      </div>
    )

  const sel = new Set(selected)
  const bulk = (a: DownloadAction): void => void window.sabi.bulk(selected, a)
  return (
    <>
      {selected.length > 0 && (
        <div className="toolbar glass" style={{ padding: '8px 12px', borderRadius: 14, marginBottom: 10 }}>
          <strong>{t('selected', { n: num(lang, selected.length) })}</strong>
          <div style={{ flex: 1 }} />
          <button className="btn sm" onClick={() => bulk('resume')}>
            <Play size={14} />
            {t('resume')}
          </button>
          <button className="btn sm" onClick={() => bulk('pause')}>
            <Pause size={14} />
            {t('pause')}
          </button>
          <button className="btn sm" onClick={() => bulk('retry')}>
            <RotateCcw size={14} />
            {t('retry')}
          </button>
          <button className="btn sm danger" onClick={() => bulk('remove')}>
            <X size={14} />
            {t('remove')}
          </button>
          <button className="btn sm ghost" onClick={() => setSelected(items.map((i) => i.id))}>
            {t('selectAll')}
          </button>
          <button className="btn sm ghost" onClick={() => setSelected([])}>
            {t('clearSelection')}
          </button>
        </div>
      )}
      <div className="list">
        {items.map((it) => (
          <Row key={it.id} item={it} nets={nets} selected={sel.has(it.id)} onMenu={open} />
        ))}
      </div>
      {menu}
    </>
  )
}

import {
  Activity,
  CircleAlert,
  CircleCheck,
  Download,
  Info,
  ListOrdered,
  Network,
  Settings as Cog,
  type LucideIcon
} from 'lucide-react'
import type { Category } from '../../../shared/types'
import { useStore, type View } from '../store'
import { useLang, useT } from '../useT'
import { CATEGORY_ICON, CATEGORY_COLOR } from './icons'
import { Logo } from './Logo'
import { num } from '../format'
import type { TKey } from '../i18n'

const CATS: Category[] = ['video', 'audio', 'archive', 'document', 'program', 'image', 'other']

export function Sidebar(): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const downloads = useStore((s) => s.downloads)
  const networks = useStore((s) => s.networks)
  const info = useStore((s) => s.info)

  const count = (v: View): number => {
    switch (v) {
      case 'all':
        return downloads.length
      case 'active':
        return downloads.filter((d) => ['downloading', 'starting', 'waiting'].includes(d.status)).length
      case 'queued':
        return downloads.filter((d) => ['queued', 'scheduled', 'paused'].includes(d.status)).length
      case 'completed':
        return downloads.filter((d) => d.status === 'completed').length
      case 'failed':
        return downloads.filter((d) => d.status === 'error').length
      default:
        return downloads.filter((d) => d.category === v).length
    }
  }

  const Item = ({ v, icon: Icon, label, color, badge = true }: { v: View; icon: LucideIcon; label: string; color?: string; badge?: boolean }): React.JSX.Element => {
    const n = badge ? count(v) : 0
    return (
      <button className={`nav-item ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
        <Icon size={17} style={color ? { color } : undefined} />
        <span>{label}</span>
        {badge && n > 0 && <span className="count num">{num(lang, n)}</span>}
      </button>
    )
  }

  const activeNets = networks.filter((n) => n.enabled && !n.capped).length

  return (
    <aside className="sidebar drag">
      <div className="brand">
        <Logo size={42} />
        <div>
          <div className="brand-name">{t('appName')}</div>
          <div className="brand-sub">{t('tagline')}</div>
        </div>
      </div>
      <Item v="all" icon={Download} label={t('all')} />
      <Item v="active" icon={Activity} label={t('active')} />
      <Item v="queued" icon={ListOrdered} label={t('queued')} />
      <Item v="completed" icon={CircleCheck} label={t('completed')} />
      <Item v="failed" icon={CircleAlert} label={t('failed')} />
      <div className="nav-title">{t('categories')}</div>
      {CATS.filter((c) => c !== 'other' || count('other') > 0).map((c) => (
        <Item key={c} v={c} icon={CATEGORY_ICON[c]} color={CATEGORY_COLOR[c]} label={t(c as TKey)} />
      ))}
      <div className="nav-title">{t('system')}</div>
      <button className={`nav-item ${view === 'networks' ? 'on' : ''}`} onClick={() => setView('networks')}>
        <Network size={17} />
        <span>{t('networks')}</span>
        <span className="count num">{num(lang, activeNets)}</span>
      </button>
      <Item v="settings" icon={Cog} label={t('settings')} badge={false} />
      <Item v="about" icon={Info} label={t('about')} badge={false} />
      <div className="sidebar-foot">
        <div className="mini-card glass" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <div style={{ display: 'flex' }}>
            {networks.slice(0, 4).map((n, i) => (
              <span key={n.id} className="dot-lg" title={n.name} style={{ width: 14, height: 14, marginInlineStart: i ? -4 : 0, border: '2px solid var(--panel-solid)', background: n.color, opacity: n.enabled ? 1 : 0.35 }} />
            ))}
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.35 }}>
            <div className="muted">{t('networksActive', { n: num(lang, activeNets) })}</div>
            <div className="faint">v{info?.version} · {t('authorName')}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

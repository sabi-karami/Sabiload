import { useMemo, useState } from 'react'
import { Lightbulb, Pencil, RefreshCw, TriangleAlert, Unplug } from 'lucide-react'
import type { NetworkInfo } from '../../../shared/types'
import { NET_PALETTE } from '../../../shared/defaults'
import { useStore } from '../store'
import { useLang, useT } from '../useT'
import { bytes, CAP_STEPS, LIMIT_STEPS, num, speed } from '../format'
import type { TKey } from '../i18n'
import { NET_ICON } from '../components/icons'
import { Switch } from '../components/Switch'

function subnet(n: NetworkInfo): string | null {
  const v4 = n.addresses.find((a) => a.family === 4)
  return v4 ? v4.address.split('.').slice(0, 3).join('.') + '.x' : null
}

function NetCard({ n }: { n: NetworkInfo }): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const settings = useStore((s) => s.settings)!
  const patch = useStore((s) => s.patchSettings)
  const unit = settings.speedUnit
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(n.name)
  const Icon = NET_ICON[n.kind]
  const set = <K extends 'netNames' | 'netColors' | 'netLimits' | 'netDailyCaps' | 'netMonthlyCaps'>(key: K, value: Settings[K][string]): void =>
    void patch({ [key]: { ...settings[key], [n.id]: value } } as Partial<Settings>)
  const capPct = n.dailyCap ? n.usage.today / n.dailyCap : n.monthlyCap ? n.usage.month / n.monthlyCap : 0

  return (
    <div className={`netcard glass ${n.enabled ? '' : 'off'}`} style={{ '--c': n.color } as React.CSSProperties}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div className="big-ico">
          <Icon size={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              className="input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                set('netNames', name.trim())
                setEditing(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', gap: 6, alignItems: 'center' }}>
              {n.name}
              <button className="btn sm icon ghost" title={t('rename')} onClick={() => setEditing(true)}>
                <Pencil size={13} />
              </button>
            </div>
          )}
          <div className="faint" style={{ fontSize: 12 }}>
            {t(`kind_${n.kind}` as TKey)} · <span className="mono">{n.device}</span>
            {n.hardware && n.hardware !== n.name ? ` · ${n.hardware}` : ''}
          </div>
        </div>
        <Switch
          on={n.enabled}
          onChange={(v) =>
            void patch({
              disabledNets: v ? settings.disabledNets.filter((x) => x !== n.id) : [...settings.disabledNets, n.id]
            })
          }
        />
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
        <span className="chip">
          <span className="dot" style={{ background: n.online === false ? 'var(--bad)' : n.online ? 'var(--good)' : 'var(--warn)', color: n.online ? 'var(--good)' : 'var(--bad)' }} />
          {n.online === null ? t('checkingNet') : n.online ? t('online') : t('offline')}
        </span>
        {n.latency !== null && (
          <span className="chip num">
            {t('latency')} {num(lang, n.latency)}ms
          </span>
        )}
        <span className="chip num">{speed(lang, n.speed, unit)}</span>
        {n.capped && (
          <span className="chip" style={{ color: 'var(--bad)' }}>
            {t('capReached')}
          </span>
        )}
      </div>
      <div className="mono faint ltr" style={{ fontSize: 11, marginBottom: 12, wordBreak: 'break-all' }}>
        {n.addresses.map((a) => a.address).join('  ·  ')}
      </div>

      <div className="setrow">
        <div className="grow">{t('speedLimit')}</div>
        <select className="select" value={n.limit} onChange={(e) => set('netLimits', Number(e.target.value))}>
          {LIMIT_STEPS.map((v) => (
            <option key={v} value={v}>
              {v ? speed(lang, v, unit) : t('unlimited')}
            </option>
          ))}
        </select>
      </div>
      <div className="setrow">
        <div className="grow">{t('dailyCap')}</div>
        <select className="select" value={n.dailyCap} onChange={(e) => set('netDailyCaps', Number(e.target.value))}>
          {CAP_STEPS.map((v) => (
            <option key={v} value={v}>
              {v ? bytes(lang, v) : t('noCap')}
            </option>
          ))}
        </select>
      </div>
      <div className="setrow">
        <div className="grow">{t('monthlyCap')}</div>
        <select className="select" value={n.monthlyCap} onChange={(e) => set('netMonthlyCaps', Number(e.target.value))}>
          {CAP_STEPS.map((v) => (
            <option key={v} value={v}>
              {v ? bytes(lang, v) : t('noCap')}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, margin: '10px 0 6px' }} className="muted">
        <span>
          {t('today')}: <b className="num">{bytes(lang, n.usage.today)}</b>
        </span>
        <span>
          {t('thisMonth')}: <b className="num">{bytes(lang, n.usage.month)}</b>
        </span>
      </div>
      {(n.dailyCap > 0 || n.monthlyCap > 0) && (
        <div className="meter">
          <span style={{ width: `${Math.min(100, capPct * 100)}%`, background: capPct > 0.9 ? 'var(--bad)' : n.color }} />
        </div>
      )}
      <div className="setrow" style={{ borderBottom: 0 }}>
        <div className="grow">{t('color')}</div>
        <div className="colors">
          {NET_PALETTE.map((c) => (
            <button key={c} className={c === n.color ? 'on' : ''} style={{ background: c }} onClick={() => set('netColors', c)} />
          ))}
        </div>
      </div>
    </div>
  )
}

type Settings = NonNullable<ReturnType<typeof useStore.getState>['settings']>

export function NetworksScreen(): React.JSX.Element {
  const t = useT()
  const networks = useStore((s) => s.networks)
  const info = useStore((s) => s.info)
  const [spinning, setSpinning] = useState(false)

  const clash = useMemo(() => {
    const on = networks.filter((n) => n.enabled)
    for (let i = 0; i < on.length; i++)
      for (let j = i + 1; j < on.length; j++) {
        const a = subnet(on[i])
        if (a && a === subnet(on[j])) return { a: on[i].name, b: on[j].name, net: a }
      }
    return null
  }, [networks])

  return (
    <div>
      <div className="page-head">
        <div style={{ flex: 1 }}>
          <h1>{t('networksTitle')}</h1>
          <div className="muted" style={{ maxWidth: 640 }}>
            {t('networksSub')}
          </div>
        </div>
        <button
          className="btn"
          onClick={async () => {
            setSpinning(true)
            await window.sabi.refreshNetworks()
            setTimeout(() => setSpinning(false), 600)
          }}
        >
          <RefreshCw size={15} className={spinning ? 'spin' : ''} />
          {t('refresh')}
        </button>
      </div>
      {info && !info.bindingOk && (
        <div className="banner" style={{ marginBottom: 14 }}>
          <TriangleAlert size={16} /> {t('bindingOff')}
        </div>
      )}
      {clash && (
        <div className="banner" style={{ marginBottom: 14 }}>
          <TriangleAlert size={16} /> {t('sameSubnet', clash)}
        </div>
      )}
      {networks.length ? (
        <div className="netgrid">
          {networks.map((n) => (
            <NetCard key={n.id} n={n} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-art">
            <Unplug size={44} />
          </div>
          <h3>{t('noNetworks')}</h3>
          <div className="muted">{t('noNetworksSub')}</div>
        </div>
      )}
      <div className="card glass" style={{ marginTop: 18 }}>
        <h3>
          <Lightbulb size={16} /> {t('tipTitle')}
        </h3>
        <ul className="muted" style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.9 }}>
          <li>{t('tip1')}</li>
          <li>{t('tip2')}</li>
          <li>{t('tip3')}</li>
        </ul>
      </div>
    </div>
  )
}

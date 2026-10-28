import { useEffect, useRef, useState } from 'react'
import { ArrowDown, Rocket, Zap } from 'lucide-react'
import type { SpeedSample } from '../../../shared/types'
import { useStore } from '../store'
import { useLang, useT } from '../useT'
import { num, speed, speedParts } from '../format'
import { Sparkline } from './Sparkline'
import { NET_ICON } from './icons'

/** The big glowing dashboard: a 3D orb, the combined speed, a live chart and the boost factor. */
export function Hero(): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const downloads = useStore((s) => s.downloads)
  const networks = useStore((s) => s.networks)
  const unit = useStore((s) => s.settings?.speedUnit ?? 'bytes')
  const [history, setHistory] = useState<SpeedSample[]>([])
  const ref = useRef({ downloads, networks })
  ref.current = { downloads, networks }

  useEffect(() => {
    const iv = setInterval(() => {
      const { downloads: d, networks: n } = ref.current
      const nets: Record<string, number> = {}
      for (const net of n) nets[net.id] = net.speed
      const total = d.reduce((s, x) => s + (x.status === 'downloading' ? x.speed : 0), 0)
      setHistory((h) => [...h.slice(-89), { t: Date.now(), total, nets }])
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  const total = downloads.reduce((s, x) => s + (x.status === 'downloading' ? x.speed : 0), 0)
  const working = networks.filter((n) => n.speed > 1024)
  const fastest = Math.max(0, ...working.map((n) => n.speed))
  const boost = fastest > 0 && working.length > 1 ? total / fastest : 0
  const [v, u] = speedParts(lang, total, unit)
  const active = total > 0
  const colors = Object.fromEntries(networks.map((n) => [n.id, n.color]))

  return (
    <section className="hero glass">
      <div className="orb-wrap">
        <div className={`orb ${active ? 'live' : ''}`}>
          <div className="ring" />
          <div className="ring r2" />
          <div className="orb-icon">{active ? <ArrowDown size={34} /> : <Zap size={32} />}</div>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        {active ? (
          <>
            <div className="hero-label">{t('combinedSpeed')}</div>
            <div className="hero-speed">
              <span className="v num">{v}</span>
              <span className="u">{u}</span>
            </div>
            <div className="hero-chips">
              {boost > 1.05 && (
                <span className="chip accent" title={t('boostHint')}>
                  <Rocket size={13} />
                  {t('boost')} ×{num(lang, boost, 1)}
                </span>
              )}
              <span className="chip">{t('networksActive', { n: num(lang, working.length) })}</span>
              {working.map((n) => {
                const Icon = NET_ICON[n.kind]
                return (
                  <span className="chip" key={n.id}>
                    <span className="dot" style={{ background: n.color, color: n.color }} />
                    <Icon size={13} />
                    <span className="num">{speed(lang, n.speed, unit)}</span>
                  </span>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="hero-speed">
              <span className="v" style={{ fontSize: 40 }}>
                {t('idleHero')}
              </span>
            </div>
            <div className="muted" style={{ maxWidth: 520 }}>
              {t('idleHeroSub')}
            </div>
            <div className="hero-chips" style={{ marginTop: 12 }}>
              {networks.map((n) => {
                const Icon = NET_ICON[n.kind]
                return (
                  <span className="chip" key={n.id} style={{ opacity: n.enabled ? 1 : 0.45 }}>
                    <span className="dot" style={{ background: n.color, color: n.color }} />
                    <Icon size={13} />
                    {n.name}
                  </span>
                )
              })}
            </div>
          </>
        )}
      </div>
      <div className="hero-spark" style={{ width: 300 }}>
        <Sparkline samples={history} colors={colors} stacked height={120} window={60} />
      </div>
    </section>
  )
}

import { useId, useMemo } from 'react'
import type { SpeedSample } from '../../../shared/types'

interface Props {
  samples: SpeedSample[]
  colors?: Record<string, string>
  height?: number
  stacked?: boolean
  window?: number
}

/** Smooth area chart; stacked per network when `stacked` is set. */
export function Sparkline({ samples, colors = {}, height = 120, stacked = false, window = 60 }: Props): React.JSX.Element {
  const id = useId().replace(/:/g, '')
  const W = 600
  const H = height
  const data = useMemo(() => {
    const s = samples.slice(-window)
    const pad = Array.from({ length: Math.max(0, window - s.length) }, () => ({ t: 0, total: 0, nets: {} }))
    return [...pad, ...s]
  }, [samples, window])
  const max = Math.max(1, ...data.map((d) => d.total)) * 1.15
  const x = (i: number): number => (i / (data.length - 1 || 1)) * W
  const y = (v: number): number => H - (v / max) * (H - 6) - 2

  const path = (vals: number[], base?: number[]): string => {
    const pts = vals.map((v, i) => [x(i), y(v)] as const)
    let d = `M${pts[0][0]},${pts[0][1]}`
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      const cx = (x0 + x1) / 2
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
    }
    if (!base) return `${d} L${W},${H} L0,${H} Z`
    const bpts = base.map((v, i) => [x(i), y(v)] as const).reverse()
    d += ` L${bpts[0][0]},${bpts[0][1]}`
    for (let i = 1; i < bpts.length; i++) {
      const [x0, y0] = bpts[i - 1]
      const [x1, y1] = bpts[i]
      const cx = (x0 + x1) / 2
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`
    }
    return `${d} Z`
  }
  const line = (vals: number[]): string => path(vals).split(' L')[0].replace(/ Z$/, '')

  const netIds = stacked ? [...new Set(data.flatMap((d) => Object.keys(d.nets)))] : []
  let acc = data.map(() => 0)
  const layers = netIds.map((nid) => {
    const base = acc
    const top = data.map((d, i) => base[i] + (d.nets[nid] ?? 0))
    acc = top
    return { nid, d: path(top, base) }
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ direction: 'ltr', display: 'block' }}>
      <defs>
        <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`l${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent2)" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line)" strokeDasharray="3 6" />
      ))}
      {stacked && layers.length ? (
        layers.map((l) => <path key={l.nid} d={l.d} fill={colors[l.nid] ?? 'var(--accent)'} fillOpacity="0.55" />)
      ) : (
        <path d={path(data.map((d) => d.total))} fill={`url(#a${id})`} />
      )}
      <path
        d={line(data.map((d) => d.total))}
        fill="none"
        stroke={`url(#l${id})`}
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }}
      />
    </svg>
  )
}

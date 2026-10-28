import { useId } from 'react'

/** The Sabiload mark: three streams braided into one arrow, on a glossy 3D tile. */
export function Logo({ size = 40 }: { size?: number }): React.JSX.Element {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--glow1)" />
          <stop offset="0.55" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent2)" />
        </linearGradient>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`f${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="var(--accent)" floodOpacity="0.55" />
        </filter>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="17" fill={`url(#g${id})`} filter={`url(#f${id})`} />
      <rect x="4" y="4" width="56" height="28" rx="17" fill={`url(#s${id})`} />
      <g fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="4.2">
        <path d="M20 16 C20 28 32 26 32 36" opacity="0.75" />
        <path d="M44 16 C44 28 32 26 32 36" opacity="0.75" />
        <path d="M32 14 V38" />
        <path d="M23 33 L32 43 L41 33" strokeLinejoin="round" />
      </g>
      <rect x="20" y="47" width="24" height="4" rx="2" fill="#fff" />
    </svg>
  )
}

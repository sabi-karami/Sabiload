import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

export function Menu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8))
    })
  }, [x, y])
  useEffect(() => {
    const close = (e: Event): void => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])
  return (
    <div ref={ref} className="menu glass" style={{ left: pos.x, top: pos.y }} role="menu">
      {items.map((it, i) =>
        it.divider ? (
          <hr key={i} />
        ) : (
          <button
            key={i}
            className={it.danger ? 'danger' : ''}
            disabled={it.disabled}
            onClick={() => {
              onClose()
              it.onClick?.()
            }}
          >
            {it.icon && <it.icon size={15} />}
            {it.label}
          </button>
        )
      )}
    </div>
  )
}

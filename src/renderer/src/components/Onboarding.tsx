import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../useT'
import { Logo } from './Logo'
import { ThemePicker } from '../screens/SettingsScreen'
import { Seg } from './Switch'

export function Onboarding(): React.JSX.Element | null {
  const t = useT()
  const s = useStore((st) => st.settings)
  const patch = useStore((st) => st.patchSettings)
  if (!s || s.onboarded) return null
  const Arrow = s.language === 'fa' ? ArrowLeft : ArrowRight
  return (
    <div className="onboard">
      <div className="dialog glass" style={{ textAlign: 'center' }}>
        <div className="orb-wrap" style={{ margin: '0 auto' }}>
          <div className="orb live">
            <div className="ring" />
            <div className="ring r2" />
            <div className="orb-icon">
              <Logo size={54} />
            </div>
          </div>
        </div>
        <h1 className="page-head" style={{ justifyContent: 'center', margin: '8px 0 4px' }}>
          <span style={{ fontSize: 30, fontWeight: 800, background: 'var(--grad-text)', WebkitBackgroundClip: 'text', color: 'transparent' }}>{t('welcome')}</span>
        </h1>
        <div className="muted" style={{ marginBottom: 22 }}>
          {t('welcomeSub')}
        </div>
        <div className="label" style={{ marginBottom: 8 }}>
          {t('pickLanguage')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Seg
            value={s.language}
            onChange={(v) => void patch({ language: v })}
            options={[
              { value: 'fa', label: 'فارسی' },
              { value: 'en', label: 'English' }
            ]}
          />
        </div>
        <div className="label" style={{ marginBottom: 8 }}>
          {t('pickTheme')}
        </div>
        <div style={{ textAlign: 'start' }}>
          <ThemePicker />
        </div>
        <button className="btn primary" style={{ marginTop: 24, height: 46, padding: '0 28px', fontSize: 15 }} onClick={() => void patch({ onboarded: true })}>
          {t('letsGo')}
          <Arrow size={18} />
        </button>
      </div>
    </div>
  )
}

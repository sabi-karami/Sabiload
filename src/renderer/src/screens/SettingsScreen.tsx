import { CalendarClock, Download, FolderOpen, Gauge, Globe, Palette, Puzzle, RefreshCw, SlidersHorizontal } from 'lucide-react'
import type { Lang, Settings, ThemeId } from '../../../shared/types'
import { useStore } from '../store'
import { useLang, useT } from '../useT'
import { LIMIT_STEPS, num, speed } from '../format'
import type { TKey } from '../i18n'
import { Seg, Switch } from '../components/Switch'
import { THEMES } from '../themes'

const RELEASES = 'https://github.com/sabi-karami/Sabiload/releases/latest'

export function ThemePicker(): React.JSX.Element {
  const t = useT()
  const theme = useStore((s) => s.settings?.theme)
  const patch = useStore((s) => s.patchSettings)
  return (
    <div className="themes">
      {THEMES.map((th) => (
        <button key={th.id} className={`theme-card ${theme === th.id ? 'on' : ''}`} onClick={() => void patch({ theme: th.id as ThemeId })}>
          <div className="theme-prev" style={{ background: `linear-gradient(135deg, ${th.swatch[0]}, ${th.swatch[1]})` }}>
            <span className="o" style={{ background: `radial-gradient(circle at 30% 30%, #fff, ${th.swatch[2]} 40%, ${th.swatch[1]})` }} />
          </div>
          <div style={{ fontWeight: 700, marginTop: 8 }}>{t(`theme_${th.id}` as TKey)}</div>
          <div className="faint" style={{ fontSize: 11.5 }}>
            {t(`theme_${th.id}_d` as TKey)}
          </div>
        </button>
      ))}
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="setrow">
      <div className="grow">
        <div>{label}</div>
        {hint && <div className="hint">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

export function SettingsScreen(): React.JSX.Element {
  const t = useT()
  const lang = useLang()
  const s = useStore((st) => st.settings)!
  const patch = useStore((st) => st.patchSettings)
  const update = useStore((st) => st.update)
  const info = useStore((st) => st.info)
  const set = (p: Partial<Settings>): void => void patch(p)
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
  const sched = s.schedule

  const updText = (): string => {
    switch (update.state) {
      case 'checking':
        return t('upd_checking')
      case 'none':
        return t('upd_none')
      case 'available':
        return t('upd_available', { v: update.version ?? '' })
      case 'downloading':
        return t('upd_downloading', { p: num(lang, update.percent ?? 0) })
      case 'ready':
        return t('upd_ready', { v: update.version ?? '' })
      case 'error':
        return t('upd_error')
      default:
        return `${t('version')} ${info?.version ?? ''}`
    }
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <div className="page-head">
        <h1>{t('settings')}</h1>
      </div>

      <div className="card glass">
        <h3>
          <Palette size={16} /> {t('appearance')}
        </h3>
        <ThemePicker />
        <Row label={t('language')}>
          <Seg<Lang>
            value={s.language}
            onChange={(v) => set({ language: v })}
            options={[
              { value: 'fa', label: 'فارسی' },
              { value: 'en', label: 'English' }
            ]}
          />
        </Row>
        <Row label={t('speedUnit')}>
          <Seg<'bytes' | 'bits'>
            value={s.speedUnit}
            onChange={(v) => set({ speedUnit: v })}
            options={[
              { value: 'bytes', label: 'MB/s' },
              { value: 'bits', label: 'Mbps' }
            ]}
          />
        </Row>
      </div>

      <div className="card glass">
        <h3>
          <Download size={16} /> {t('downloads')}
        </h3>
        <Row label={t('defaultFolder')} hint={s.downloadDir}>
          <button
            className="btn sm"
            onClick={async () => {
              const d = await window.sabi.chooseFolder(s.downloadDir)
              if (d) set({ downloadDir: d })
            }}
          >
            <FolderOpen size={14} />
            {t('change')}
          </button>
        </Row>
        <Row label={t('maxConcurrent')}>
          <Seg<number> value={s.maxConcurrent} onChange={(v) => set({ maxConcurrent: v })} options={[1, 2, 3, 4, 6, 8].map((v) => ({ value: v, label: num(lang, v) }))} />
        </Row>
        <Row label={t('streamsLabel')} hint={t('autoHint')}>
          <Seg<string>
            value={String(s.streamsMode)}
            onChange={(v) => set({ streamsMode: v === 'auto' ? 'auto' : Number(v) })}
            options={['auto', '4', '8', '16', '32'].map((v) => ({ value: v, label: v === 'auto' ? t('auto') : num(lang, Number(v)) }))}
          />
        </Row>
        <Row label={t('categorize')}>
          <Switch on={s.categorizeFolders} onChange={(v) => set({ categorizeFolders: v })} />
        </Row>
        <Row label={t('preventSleep')}>
          <Switch on={s.preventSleep} onChange={(v) => set({ preventSleep: v })} />
        </Row>
        <Row label={t('notifications')}>
          <Switch on={s.notifications} onChange={(v) => set({ notifications: v })} />
        </Row>
      </div>

      <div className="card glass">
        <h3>
          <Gauge size={16} /> {t('speedSection')}
        </h3>
        <Row label={t('globalLimit')}>
          <select className="select" value={s.globalLimit} onChange={(e) => set({ globalLimit: Number(e.target.value) })}>
            {LIMIT_STEPS.map((v) => (
              <option key={v} value={v}>
                {v ? speed(lang, v, s.speedUnit) : t('unlimited')}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t('slowLimit')} hint={t('slowModeHint')}>
          <select className="select" value={s.slowLimit} onChange={(e) => set({ slowLimit: Number(e.target.value) })}>
            {LIMIT_STEPS.filter(Boolean).map((v) => (
              <option key={v} value={v}>
                {speed(lang, v, s.speedUnit)}
              </option>
            ))}
          </select>
        </Row>
      </div>

      <div className="card glass">
        <h3>
          <CalendarClock size={16} /> {t('schedule')}
        </h3>
        <Row label={t('scheduleEnable')}>
          <Switch on={sched.enabled} onChange={(v) => set({ schedule: { ...sched, enabled: v } })} />
        </Row>
        <div style={{ opacity: sched.enabled ? 1 : 0.45, pointerEvents: sched.enabled ? 'auto' : 'none' }}>
          <Row label={`${t('from')} / ${t('to')}`}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="ltr">
              <input type="time" className="input" style={{ width: 120 }} value={sched.start} onChange={(e) => set({ schedule: { ...sched, start: e.target.value } })} />
              →
              <input type="time" className="input" style={{ width: 120 }} value={sched.end} onChange={(e) => set({ schedule: { ...sched, end: e.target.value } })} />
            </div>
          </Row>
          <Row label={t('days')}>
            <div className="days">
              {days.map((d, i) => {
                const on = sched.days.includes(i)
                return (
                  <button
                    key={d}
                    className={on ? 'on' : ''}
                    onClick={() =>
                      set({ schedule: { ...sched, days: on ? sched.days.filter((x) => x !== i) : [...sched.days, i].sort() } })
                    }
                  >
                    {t(d)}
                  </button>
                )
              })}
            </div>
          </Row>
        </div>
      </div>

      <div className="card glass">
        <h3>
          <Puzzle size={16} /> {t('integration')}
        </h3>
        <Row label={t('bridgeEnable')} hint={t('extensionHelp')}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn sm" onClick={() => void window.sabi.openExternal(RELEASES)}>
              <Globe size={14} />
              {t('getExtension')}
            </button>
            <Switch on={s.bridgeEnabled} onChange={(v) => set({ bridgeEnabled: v })} />
          </div>
        </Row>
        <Row label={t('askBefore')}>
          <Switch on={s.askBeforeBridge} onChange={(v) => set({ askBeforeBridge: v })} />
        </Row>
        <Row label={t('clipboard')}>
          <Switch on={s.clipboardWatch} onChange={(v) => set({ clipboardWatch: v })} />
        </Row>
      </div>

      <div className="card glass">
        <h3>
          <SlidersHorizontal size={16} /> {t('behaviour')}
        </h3>
        <Row label={t('closeToTray')}>
          <Switch on={s.closeToTray} onChange={(v) => set({ closeToTray: v })} />
        </Row>
      </div>

      <div className="card glass">
        <h3>
          <RefreshCw size={16} /> {t('updates')}
        </h3>
        <Row label={t('autoUpdate')}>
          <Switch on={s.autoUpdate} onChange={(v) => set({ autoUpdate: v })} />
        </Row>
        <Row label={updText()}>
          {update.state === 'ready' || update.state === 'available' ? (
            <button className="btn sm primary" onClick={() => void window.sabi.installUpdate()}>
              {update.state === 'ready' ? t('restartNow') : t('getUpdate')}
            </button>
          ) : (
            <button className="btn sm" disabled={update.state === 'checking'} onClick={() => void window.sabi.checkUpdate()}>
              <RefreshCw size={14} className={update.state === 'checking' ? 'spin' : ''} />
              {t('checkNow')}
            </button>
          )}
        </Row>
      </div>
    </div>
  )
}

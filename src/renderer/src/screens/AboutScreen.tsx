import { Bug, Globe, Heart, Layers, Mail, Rocket, Shield, Star, Zap, CalendarClock, Puzzle, Gauge } from 'lucide-react'
import { useStore } from '../store'
import { useT } from '../useT'
import { Logo } from '../components/Logo'
import { GithubIcon, InstagramIcon, TelegramIcon } from '../components/icons'

const REPO = 'https://github.com/sabi-karami/Sabiload'

export function AboutScreen(): React.JSX.Element {
  const t = useT()
  const info = useStore((s) => s.info)
  const lang = useStore((s) => s.settings?.language ?? 'fa')
  const open = (u: string) => () => void window.sabi.openExternal(u)
  const features =
    lang === 'fa'
      ? [
          [Layers, 'ترکیب همهٔ شبکه‌ها', 'وای‌فای، اترنت، اینترنت گوشی و USB با هم'],
          [Zap, 'جریان‌های هوشمند', 'تا ۳۲ اتصال برای هر شبکه با تنظیم خودکار'],
          [Rocket, 'پایان سریع', 'تکه‌های کند به اتصال‌های آزاد سپرده می‌شوند'],
          [Shield, 'ادامهٔ مطمئن', 'ادامه پس از قطعی، خواب یا بستن برنامه'],
          [CalendarClock, 'زمان‌بندی', 'دانلود فقط در ساعت‌های دلخواه'],
          [Gauge, 'کنترل مصرف', 'محدودیت سرعت و سقف حجم برای هر شبکه'],
          [Puzzle, 'افزونهٔ مرورگر', 'دریافت دانلود از کروم، اج و فایرفاکس']
        ]
      : [
          [Layers, 'Every network at once', 'Wi-Fi, Ethernet, mobile data and USB together'],
          [Zap, 'Smart streams', 'Up to 32 connections per network, tuned automatically'],
          [Rocket, 'Fast finish', 'Slow pieces are re-assigned to idle connections'],
          [Shield, 'Rock-solid resume', 'Survives drops, sleep and restarts'],
          [CalendarClock, 'Scheduler', 'Download only at the hours you choose'],
          [Gauge, 'Data control', 'Speed limits and data allowances per network'],
          [Puzzle, 'Browser extension', 'Catch downloads from Chrome, Edge and Firefox']
        ]
  return (
    <div style={{ maxWidth: 900 }}>
      <div className="about-hero glass">
        <div className="tilt" style={{ display: 'inline-block' }}>
          <Logo size={96} />
        </div>
        <h1>{t('appName')}</h1>
        <div className="muted" style={{ fontSize: 15 }}>
          {t('tagline')}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <span className="chip accent">
            {t('version')} {info?.version}
          </span>
          <span className="chip">
            {info?.platform} · {info?.arch}
          </span>
          <span className="chip">Electron {info?.electron}</span>
        </div>
        <p className="muted" style={{ maxWidth: 620, margin: '16px auto 0', lineHeight: 1.9 }}>
          {t('aboutBody')}
        </p>
      </div>

      <div className="feature-grid" style={{ margin: '16px 0' }}>
        {features.map(([Icon, title, sub], i) => {
          const I = Icon as typeof Zap
          return (
            <div key={i} className="feature glass">
              <I size={20} />
              <div>
                <div style={{ fontWeight: 700 }}>{title as string}</div>
                <div className="faint" style={{ fontSize: 12 }}>
                  {sub as string}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card glass">
        <h3>{t('createdBy')}</h3>
        <div className="author">
          <div className="avatar">SK</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{t('authorName')}</div>
            <div className="muted">{t('authorRole')}</div>
          </div>
        </div>
        <div className="links" style={{ marginTop: 14 }}>
          <button className="btn" onClick={open('https://github.com/sabi-karami')}>
            <GithubIcon /> sabi-karami
          </button>
          <button className="btn" onClick={open('https://t.me/sahebkarami')}>
            <TelegramIcon /> @sahebkarami
          </button>
          <button className="btn" onClick={open('https://instagram.com/sahebkarami')}>
            <InstagramIcon /> @sahebkarami
          </button>
          <button className="btn" onClick={open('mailto:saheb.karami@gmail.com')}>
            <Mail size={16} /> saheb.karami@gmail.com
          </button>
          <button className="btn" onClick={open('https://www.sahebkarami.com')}>
            <Globe size={16} /> sahebkarami.com
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={open(REPO)}>
          <Star size={16} /> {t('starOnGithub')}
        </button>
        <button className="btn" onClick={open(`${REPO}/issues/new/choose`)}>
          <Bug size={16} /> {t('reportBug')}
        </button>
        <button className="btn" onClick={open('https://sabi-karami.github.io/Sabiload/')}>
          <Globe size={16} /> {t('website')}
        </button>
      </div>
      <div className="faint" style={{ marginTop: 18, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Heart size={14} style={{ color: 'var(--bad)' }} /> {t('madeIn')} · {t('license')} · © 2026 {t('authorName')}
      </div>
    </div>
  )
}

import type { Lang } from '../shared/types'

const STRINGS = {
  en: {
    done: 'Download complete',
    failed: 'Download failed',
    show: 'Show Sabiload',
    pauseAll: 'Pause all',
    resumeAll: 'Resume all',
    quit: 'Quit',
    newDownload: 'New download…',
    speed: 'Speed'
  },
  fa: {
    done: 'دانلود کامل شد',
    failed: 'دانلود ناموفق بود',
    show: 'نمایش صبی‌لود',
    pauseAll: 'توقف همه',
    resumeAll: 'ادامهٔ همه',
    quit: 'خروج',
    newDownload: 'دانلود جدید…',
    speed: 'سرعت'
  }
} as const

export type MainKey = keyof (typeof STRINGS)['en']
export const tr = (lang: Lang, key: MainKey): string => STRINGS[lang]?.[key] ?? STRINGS.en[key]

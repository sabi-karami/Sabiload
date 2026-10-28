import type { Settings } from './types'

export const DEFAULT_SETTINGS: Omit<Settings, 'downloadDir'> = {
  language: 'fa',
  theme: 'nebula',
  maxConcurrent: 3,
  streamsMode: 'auto',
  globalLimit: 0,
  slowMode: false,
  slowLimit: 512 * 1024,
  speedUnit: 'bytes',
  netNames: {},
  netColors: {},
  netLimits: {},
  netDailyCaps: {},
  netMonthlyCaps: {},
  disabledNets: [],
  schedule: { enabled: false, start: '01:00', end: '07:00', days: [0, 1, 2, 3, 4, 5, 6] },
  bridgeEnabled: true,
  bridgePort: 17345,
  askBeforeBridge: true,
  clipboardWatch: false,
  notifications: true,
  autoUpdate: true,
  closeToTray: false,
  preventSleep: true,
  categorizeFolders: false,
  onboarded: false
}

export const NET_PALETTE = [
  '#8b5cf6',
  '#06b6d4',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ec4899',
  '#84cc16'
]

export const BRIDGE_HEADER = 'x-sabiload'

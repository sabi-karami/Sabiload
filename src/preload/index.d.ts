import type { SabiApi } from '../shared/ipc'

declare global {
  interface Window {
    sabi: SabiApi
  }
}

export {}

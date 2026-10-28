import {
  Cable,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Network,
  Package,
  Shield,
  Smartphone,
  SignalHigh,
  Wifi,
  type LucideIcon
} from 'lucide-react'
import type { Category, NetKind } from '../../../shared/types'

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  video: FileVideo,
  audio: FileAudio,
  archive: FileArchive,
  document: FileText,
  program: Package,
  image: FileImage,
  other: File
}

export const CATEGORY_COLOR: Record<Category, string> = {
  video: '#f43f5e',
  audio: '#ec4899',
  archive: '#f59e0b',
  document: '#3b82f6',
  program: '#8b5cf6',
  image: '#10b981',
  other: '#64748b'
}

export const NET_ICON: Record<NetKind, LucideIcon> = {
  wifi: Wifi,
  ethernet: Cable,
  cellular: SignalHigh,
  usb: Smartphone,
  vpn: Shield,
  other: Network
}

export function GithubIcon({ size = 16 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

export function InstagramIcon({ size = 16 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TelegramIcon({ size = 16 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.3 18.7 19.4c-.24 1.07-.87 1.33-1.76.83l-4.87-3.59-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.96 9.03-8.16c.39-.35-.09-.54-.61-.2L6.36 13.07l-4.8-1.5c-1.04-.33-1.06-1.04.22-1.54L20.55 2.8c.87-.32 1.63.2 1.35 1.5Z" />
    </svg>
  )
}

import type { ThemeId } from '../../shared/types'

export const THEMES: { id: ThemeId; swatch: string[]; bar: string; symbol: string }[] = [
  { id: 'nebula', swatch: ['#7c3aed', '#2563eb', '#06b6d4'], bar: '#00000000', symbol: '#e9e6ff' },
  { id: 'aurora', swatch: ['#10b981', '#06b6d4', '#22d3ee'], bar: '#00000000', symbol: '#d9fffb' },
  { id: 'royal', swatch: ['#0a0a0a', '#b8860b', '#f5d77a'], bar: '#00000000', symbol: '#f7e7b4' },
  { id: 'pearl', swatch: ['#c4b5fd', '#f9a8d4', '#a5f3fc'], bar: '#00000000', symbol: '#2a2540' }
]

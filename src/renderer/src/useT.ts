import { useCallback } from 'react'
import { useStore } from './store'
import { translate, type TKey } from './i18n'

export function useLang(): 'fa' | 'en' {
  return useStore((s) => s.settings?.language ?? 'fa')
}

export function useT(): (key: TKey, vars?: Record<string, string | number>) => string {
  const lang = useLang()
  return useCallback((key, vars) => translate(lang, key, vars), [lang])
}

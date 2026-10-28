import { EventEmitter } from 'node:events'
import path from 'node:path'
import { app } from 'electron'
import type { Settings } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/defaults'
import { readJson, writeJson } from './core/jsonStore'

export class SettingsStore extends EventEmitter {
  private value!: Settings
  private file = path.join(app.getPath('userData'), 'settings.json')

  async load(): Promise<Settings> {
    const saved = await readJson<Partial<Settings>>(this.file, {})
    const locale = app.getLocale().toLowerCase()
    const language = locale.startsWith('fa') ? 'fa' : locale ? 'en' : DEFAULT_SETTINGS.language
    this.value = {
      ...DEFAULT_SETTINGS,
      language,
      downloadDir: app.getPath('downloads'),
      ...saved,
      schedule: { ...DEFAULT_SETTINGS.schedule, ...(saved.schedule ?? {}) }
    }
    return this.value
  }

  get(): Settings {
    return this.value
  }

  async set(patch: Partial<Settings>): Promise<Settings> {
    this.value = { ...this.value, ...patch }
    this.value.maxConcurrent = Math.min(10, Math.max(1, Math.round(this.value.maxConcurrent)))
    await writeJson(this.file, this.value)
    this.emit('change', this.value, patch)
    return this.value
  }
}

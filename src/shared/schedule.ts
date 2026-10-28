import type { Schedule } from './types'

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => Number.parseInt(v, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/** Whether downloads may run at `date`. Windows that cross midnight (23:00 → 07:00) belong to
 * the day they started on. */
export function scheduleAllows(schedule: Schedule, date = new Date()): boolean {
  if (!schedule.enabled) return true
  const start = minutes(schedule.start)
  const end = minutes(schedule.end)
  const now = date.getHours() * 60 + date.getMinutes()
  const today = date.getDay()
  const yesterday = (today + 6) % 7
  const days = schedule.days.length ? schedule.days : [0, 1, 2, 3, 4, 5, 6]
  if (start === end) return days.includes(today)
  if (start < end) return days.includes(today) && now >= start && now < end
  // Overnight window.
  if (now >= start) return days.includes(today)
  if (now < end) return days.includes(yesterday)
  return false
}

/** Milliseconds until the window next opens (or 0 when it is open). */
export function msUntilOpen(schedule: Schedule, from = new Date()): number {
  if (scheduleAllows(schedule, from)) return 0
  const probe = new Date(from)
  probe.setSeconds(0, 0)
  for (let i = 0; i < 8 * 24 * 60; i++) {
    probe.setMinutes(probe.getMinutes() + 1)
    if (scheduleAllows(schedule, probe)) return probe.getTime() - from.getTime()
  }
  return 0
}

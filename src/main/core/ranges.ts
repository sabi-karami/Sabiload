export type Range = [number, number]

/** Sorted, merged copy of half-open ranges. */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const out: Range[] = []
  for (const [a, b] of sorted) {
    const last = out[out.length - 1]
    if (last && a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/** The parts of [0, size) not covered by `done`. */
export function complement(done: Range[], size: number): Range[] {
  const merged = mergeRanges(done)
  const out: Range[] = []
  let cursor = 0
  for (const [a, b] of merged) {
    if (a > cursor) out.push([cursor, Math.min(a, size)])
    cursor = Math.max(cursor, b)
  }
  if (cursor < size) out.push([cursor, size])
  return out.filter(([a, b]) => b > a)
}

export function totalLength(ranges: Range[]): number {
  return ranges.reduce((sum, [a, b]) => sum + (b - a), 0)
}

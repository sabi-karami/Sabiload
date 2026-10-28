import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

const chains = new Map<string, Promise<void>>()

/** Atomic, serialized JSON writes: a crash never leaves half a file behind. */
export function writeJson(file: string, value: unknown): Promise<void> {
  const prev = chains.get(file) ?? Promise.resolve()
  const next = prev.then(async () => {
    await mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(value, null, 1))
    await rename(tmp, file)
  })
  const settled = next.catch((e) => console.warn('[sabiload] save failed', file, e))
  chains.set(file, settled)
  return settled
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Engine, type EngineNet } from '../src/main/core/engine'
import { RateLimiter } from '../src/main/core/limiter'
import { probe } from '../src/main/core/probe'
import { parseContentDisposition, sanitizeFileName } from '../src/main/core/filename'
import { complement, mergeRanges } from '../src/main/core/ranges'
import { scheduleAllows } from '../src/shared/schedule'

const DATA = randomBytes(24 * 1024 * 1024 + 12345)
const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

interface ServerOpts { ranges?: boolean; slowFrom?: string; bytesPerSec?: number }
function serve(opts: ServerOpts = {}): Promise<{ url: string; close: () => void; hits: Record<string, number> }> {
  const hits: Record<string, number> = {}
  const srv = http.createServer((req, res) => {
    const from = req.socket.localAddress ?? ''
    hits[req.socket.remoteAddress ?? '?'] = (hits[req.socket.remoteAddress ?? '?'] ?? 0) + 1
    if (req.url === '/redirect') { res.writeHead(302, { location: '/file.bin' }); res.end(); return }
    const range = req.headers.range?.match(/bytes=(\d+)-(\d*)/)
    let start = 0, end = DATA.length - 1, status = 200
    const headers: Record<string, string | number> = {
      'content-type': 'application/octet-stream',
      'content-disposition': "attachment; filename*=UTF-8''%D8%B3%D9%84%D8%A7%D9%85.bin"
    }
    if (opts.ranges !== false) headers['accept-ranges'] = 'bytes'
    if (range && opts.ranges !== false) {
      start = Number(range[1]); end = range[2] ? Number(range[2]) : DATA.length - 1
      status = 206
      headers['content-range'] = `bytes ${start}-${end}/${DATA.length}`
    }
    headers['content-length'] = end - start + 1
    res.writeHead(status, headers)
    const body = DATA.subarray(start, end + 1)
    const slow = opts.slowFrom && req.socket.remoteAddress?.includes(opts.slowFrom)
    if (!slow) { res.end(body); return }
    let off = 0
    const iv = setInterval(() => {
      if (res.destroyed) return clearInterval(iv)
      const n = Math.min(64 * 1024, body.length - off)
      res.write(body.subarray(off, off + n)); off += n
      if (off >= body.length) { clearInterval(iv); res.end() }
    }, 100)
    res.on('close', () => clearInterval(iv))
    void from
  })
  return new Promise((r) => srv.listen(0, '0.0.0.0', () => {
    const port = (srv.address() as { port: number }).port
    r({ url: `http://127.0.0.1:${port}/file.bin`, close: () => { srv.closeAllConnections(); srv.close() }, hits })
  }))
}

const nets = (): EngineNet[] => [
  { id: 'a', route: { device: 'lo', addresses: [{ address: '127.0.0.1', family: 4 }] }, limiter: new RateLimiter() },
  { id: 'b', route: { device: 'lo', addresses: [{ address: '127.0.0.2', family: 4 }] }, limiter: new RateLimiter() }
]

async function run(url: string, extra: Partial<ConstructorParameters<typeof Engine>[0]> = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'sabi-'))
  const partPath = path.join(dir, 'f.sabipart')
  const engine = new Engine({
    url, partPath, statePath: partPath + '.json', size: DATA.length, resumable: true,
    headers: {}, nets: nets(), streamsMode: 'auto', global: new RateLimiter(), done: [], ...extra
  })
  return { engine, partPath, dir }
}

test('helpers', () => {
  assert.equal(parseContentDisposition("attachment; filename*=UTF-8''%D8%B3%D9%84%D8%A7%D9%85.zip"), 'سلام.zip')
  assert.equal(parseContentDisposition('attachment; filename="=?UTF-8?B?2LPZhNin2YU=?=.zip"'), 'سلام.zip')
  assert.equal(parseContentDisposition('inline; filename="a b.txt"'), 'a b.txt')
  assert.equal(sanitizeFileName('con.txt'), '_con.txt')
  assert.equal(sanitizeFileName('a<b>:c?.zip'), 'a_b_c_.zip')
  assert.deepEqual(mergeRanges([[5, 9], [0, 3], [3, 5]]), [[0, 9]])
  assert.deepEqual(complement([[2, 4], [6, 8]], 10), [[0, 2], [4, 6], [8, 10]])
  const s = { enabled: true, start: '23:00', end: '07:00', days: [0, 1, 2, 3, 4, 5, 6] }
  assert.equal(scheduleAllows(s, new Date(2026, 0, 1, 23, 30)), true)
  assert.equal(scheduleAllows(s, new Date(2026, 0, 1, 6, 59)), true)
  assert.equal(scheduleAllows(s, new Date(2026, 0, 1, 12, 0)), false)
})

test('probe follows redirects and reads metadata', async () => {
  const srv = await serve()
  const r = await probe(srv.url.replace('/file.bin', '/redirect'), nets()[0].route)
  srv.close()
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.size, DATA.length)
    assert.equal(r.resumable, true)
    assert.equal(r.fileName, 'سلام.bin')
    assert.ok(r.finalUrl.endsWith('/file.bin'))
  }
})

test('parallel download over two routes is byte-exact', async () => {
  const srv = await serve()
  const { engine, partPath } = await run(srv.url)
  const result = await engine.run()
  srv.close()
  assert.equal(result, 'complete')
  assert.equal(sha(await readFile(partPath)), sha(DATA))
  const snap = engine.snapshot()
  assert.ok(snap.nets.a.bytes > 0 && snap.nets.b.bytes > 0, JSON.stringify(snap.nets))
  assert.equal(snap.nets.a.bytes + snap.nets.b.bytes, DATA.length)
})

test('slow route gets less, stealing finishes the file', async () => {
  const srv = await serve({ slowFrom: '127.0.0.2' })
  const { engine, partPath } = await run(srv.url)
  const t = Date.now()
  await engine.run()
  srv.close()
  assert.equal(sha(await readFile(partPath)), sha(DATA))
  const snap = engine.snapshot()
  console.log('fast', snap.nets.a.bytes, 'slow', snap.nets.b.bytes, 'ms', Date.now() - t)
  assert.ok(snap.nets.a.bytes > snap.nets.b.bytes * 3)
})

test('pause and resume continue from the checkpoint', async () => {
  const srv = await serve({ slowFrom: '127.0.0.' })
  const first = await run(srv.url)
  const p = first.engine.run()
  await new Promise((r) => setTimeout(r, 1500))
  await first.engine.stop()
  assert.equal(await p, 'stopped')
  const state = JSON.parse(await readFile(first.partPath + '.json', 'utf8'))
  const doneBytes = state.done.reduce((s: number, d: { s: number; e: number }) => s + d.e - d.s, 0)
  assert.ok(doneBytes > 0 && doneBytes < DATA.length, String(doneBytes))
  const second = new Engine({
    url: srv.url, partPath: first.partPath, statePath: first.partPath + '.json', size: DATA.length,
    resumable: true, headers: {}, nets: [nets()[1]], streamsMode: 8, global: new RateLimiter(), done: state.done
  })
  assert.equal(await second.run(), 'complete')
  srv.close()
  assert.equal(sha(await readFile(first.partPath)), sha(DATA))
  assert.ok(second.snapshot().nets.b.bytes <= DATA.length - doneBytes)
})

test('server without range support uses a single stream', async () => {
  const srv = await serve({ ranges: false })
  const { engine, partPath } = await run(srv.url, { resumable: false })
  assert.equal(await engine.run(), 'complete')
  srv.close()
  assert.equal(sha(await readFile(partPath)), sha(DATA))
})

test('speed limit is respected', async () => {
  const srv = await serve()
  const small = DATA.subarray(0, 3 * 1024 * 1024)
  void small
  const { engine } = await run(srv.url, { global: new RateLimiter(4 * 1024 * 1024) })
  const p = engine.run()
  await new Promise((r) => setTimeout(r, 2000))
  const got = engine.snapshot().received
  await engine.stop(); await p
  srv.close()
  console.log('limited bytes in 2s', got)
  assert.ok(got < 4 * 1024 * 1024 * 2 + 2 * 1024 * 1024, String(got))
})

test('network leaving mid-download hands work to the other', async () => {
  const srv = await serve({ slowFrom: '127.0.0.1' })
  const { engine, partPath } = await run(srv.url)
  const p = engine.run()
  await new Promise((r) => setTimeout(r, 800))
  engine.setNets([nets()[1]])
  assert.equal(await p, 'complete')
  srv.close()
  assert.equal(sha(await readFile(partPath)), sha(DATA))
})

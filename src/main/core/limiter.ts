/** Token bucket: `take(n)` tells how long to wait so the average stays at `rate` bytes/s. */
export class RateLimiter {
  private tokens = 0
  private last = performance.now()

  constructor(private rate = 0) {
    this.tokens = this.burst()
  }

  private burst(): number {
    return Math.max(64 * 1024, this.rate * 0.25)
  }

  get limit(): number {
    return this.rate
  }

  setRate(rate: number): void {
    if (rate === this.rate) return
    this.rate = Math.max(0, rate)
    this.tokens = Math.min(this.tokens, this.burst())
  }

  /** Consume `n` bytes; returns milliseconds to pause before reading more (0 = carry on). */
  take(n: number): number {
    if (!this.rate) return 0
    const now = performance.now()
    this.tokens = Math.min(this.burst(), this.tokens + ((now - this.last) / 1000) * this.rate)
    this.last = now
    this.tokens -= n
    return this.tokens >= 0 ? 0 : Math.ceil((-this.tokens / this.rate) * 1000)
  }
}

export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve()
    const t = setTimeout(done, ms)
    function done(): void {
      clearTimeout(t)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })

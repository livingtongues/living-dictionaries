/**
 * Leader-worker boot robustness — mirror of house's
 * `$lib/db/worker/boot-recovery.ts`. A HANGING instance factory (not a throw) has
 * no timeout, so it never announces `ready` and never posts `boot_failed` — the
 * spawning tab holds the `navigator.locks` lock forever and every tab's RPCs
 * wedge as "no leader responded" (a factory stuck on a slow/locked OPFS handle is
 * exactly this). LD additionally never had the resign-on-boot-failure wiring at
 * all, so this brings the per-dict worker fully up to house's anti-wedge state.
 *
 * Two pure pieces, unit-tested here, wired into `leader-worker.ts` (watchdog) and
 * `db-client.ts` (bounded same-tab retry):
 *   - `with_boot_timeout` turns a hang into a rejection → the `boot_failed`
 *     recovery path fires.
 *   - `boot_retry_decision` lets the spawning tab re-attempt its OWN boot a few
 *     times with backoff BEFORE resigning — so a SINGLE tab (no other waiter to
 *     promote) can self-heal a transient hang instead of dead-ending, while the
 *     bound prevents an infinite spin.
 *
 * Keep in sync with house's copy.
 */

/** Healthy boot is ~1s (+ cold migrations); comfortably below the 20s RPC timeout. */
export const BOOT_TIMEOUT_MS = 12_000
/**
 * Idle (no-progress) boot ceiling. The boot watchdog fires only after this long
 * with NO progress tick — NOT a wall-clock cap. A slow-but-progressing snapshot
 * download (streaming in over a poor connection, ticking per chunk) keeps
 * resetting it and NEVER trips; a true hang (stuck OPFS handle, dead connection
 * with zero bytes) still does. This is why a 14 MB dict on slow mobile is no
 * longer SSR-locked by a fixed 12 s cap. Keep it comfortably above one chunk's
 * worst-case inter-arrival gap.
 */
export const BOOT_IDLE_TIMEOUT_MS = 20_000
/** Total boot attempts = 1 + MAX_BOOT_RETRIES before the tab resigns leadership. */
export const MAX_BOOT_RETRIES = 2
export const BOOT_RETRY_BASE_MS = 500

/**
 * After the fast in-tab boot retries are spent the tab RESIGNS the lock (so any
 * other waiter can try). But a LONE tab with no other waiter used to dead-end
 * there forever — `open_dict`'s `ready()` never resolved. So after resigning it
 * RE-ENTERS the election on a slower backoff: whenever it re-wins the lock it
 * re-boots, self-healing a transient cause (a deploy window, a poor connection)
 * without a manual reload. Long backoff (capped) → a background retry, not a spin;
 * it collapses to a no-op the moment another tab becomes a healthy leader.
 */
export const REELECT_BASE_MS = 2_000
export const REELECT_MAX_MS = 30_000

export interface BootFault {
  /** `hang` = never resolve (forces the watchdog); `throw` = reject immediately. */
  mode: 'hang' | 'throw'
  /** Fault the next N boot attempts, then let it succeed (recovery test). */
  count: number
  /** Optional short watchdog override so a synthetic test doesn't wait 12s. */
  timeout_ms?: number
}

/** Reject with a `boot_timeout` error if `promise` hasn't settled within `ms`. */
export function with_boot_timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => {
      const err = new Error(`leader boot timed out after ${ms}ms`) as Error & { code?: string }
      err.code = 'boot_timeout'
      reject(err)
    }, ms)),
  ])
}

export interface BootWatchdog {
  /** Race a boot promise against the idle timer; rejects `boot_timeout` on stall. */
  guard: <T>(promise: Promise<T>) => Promise<T>
  /** Reset the idle deadline — call on every boot progress tick (a fetched chunk, a completed stage). */
  tick: () => void
}

/**
 * Idle/no-progress boot watchdog. Unlike `with_boot_timeout` (a fixed wall-clock
 * cap that would kill a legitimately slow download), this fires ONLY when boot
 * makes no forward progress for `idle_ms`. `tick()` — driven by the factory's
 * per-chunk / per-stage progress — resets the deadline. Zero ticks degrades to
 * exactly `with_boot_timeout` behaviour (a factory that HANGS with no progress
 * still trips after `idle_ms`), so the synthetic `hang` fault is still caught.
 */
export function create_boot_watchdog({ idle_ms }: { idle_ms: number }): BootWatchdog {
  let timer: ReturnType<typeof setTimeout> | null = null
  let reject_fn: ((err: Error) => void) | null = null
  let settled = false

  function arm(): void {
    if (settled || !reject_fn)
      return
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      const err = new Error(`leader boot stalled — no progress for ${idle_ms}ms`) as Error & { code?: string }
      err.code = 'boot_timeout'
      reject_fn?.(err)
    }, idle_ms)
  }

  function disarm(): void {
    settled = true
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    tick(): void { arm() },
    guard<T>(promise: Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        reject_fn = reject
        arm()
        promise.then(
          (value) => { disarm(); resolve(value) },
          // Forward the ORIGINAL rejection verbatim (preserves `.code` for callers).
          (reason) => { disarm(); reject(reason) },
        )
      })
    },
  }
}

/** Should the spawning tab retry its own leader boot, and after how long? */
export function boot_retry_decision({ attempt }: { attempt: number }): { will_retry: boolean, delay_ms: number } {
  const will_retry = attempt < MAX_BOOT_RETRIES
  return { will_retry, delay_ms: will_retry ? BOOT_RETRY_BASE_MS * 2 ** attempt : 0 }
}

/** Backoff before re-entering the election after a resign (exponential, capped). */
export function reelect_delay({ attempt }: { attempt: number }): number {
  return Math.min(REELECT_BASE_MS * 2 ** attempt, REELECT_MAX_MS)
}

/**
 * Synthetic fault injection for the wedge harness — read once, on the main
 * thread, from a window flag a test sets BEFORE the DB client spawns. Inert in
 * production (the flag is never set).
 */
export function read_boot_fault(): BootFault | undefined {
  const flag = (globalThis as { __LD_DB_BOOT_FAULT__?: BootFault }).__LD_DB_BOOT_FAULT__
  if (flag && (flag.mode === 'hang' || flag.mode === 'throw') && typeof flag.count === 'number')
    return { mode: flag.mode, count: flag.count, timeout_ms: flag.timeout_ms }
  return undefined
}

/** In the leader worker: apply an injected boot fault (no-op when none). */
export async function apply_boot_fault(fault: BootFault['mode'] | undefined): Promise<void> {
  if (fault === 'throw') {
    const err = new Error('synthetic boot fault (throw)') as Error & { code?: string }
    err.code = 'boot_fault'
    throw err
  }
  if (fault === 'hang') {
    // Never calls resolve/reject → stays pending forever → the watchdog must fire.
    await new Promise<never>((resolve) => { void resolve })
  }
}

if (import.meta.vitest) {
  describe(with_boot_timeout, () => {
    it('passes through a promise that settles in time', async () => {
      await expect(with_boot_timeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
    })
    it('rejects with code "boot_timeout" when the promise hangs', async () => {
      await expect(with_boot_timeout(apply_boot_fault('hang'), 10)).rejects.toMatchObject({ code: 'boot_timeout' })
    })
    it('propagates a real rejection unchanged', async () => {
      const boom = Object.assign(new Error('boom'), { code: 'internal' })
      await expect(with_boot_timeout(Promise.reject(boom), 50)).rejects.toBe(boom)
    })
  })

  describe(create_boot_watchdog, () => {
    it('resolves when the promise settles before the idle window (no ticks needed)', async () => {
      const watchdog = create_boot_watchdog({ idle_ms: 50 })
      await expect(watchdog.guard(Promise.resolve('ok'))).resolves.toBe('ok')
    })

    it('rejects "boot_timeout" when the promise hangs with NO progress ticks', async () => {
      const watchdog = create_boot_watchdog({ idle_ms: 15 })
      await expect(watchdog.guard(new Promise(() => undefined))).rejects.toMatchObject({ code: 'boot_timeout' })
    })

    it('does NOT trip while ticks keep arriving faster than idle_ms (slow-but-progressing download)', async () => {
      const watchdog = create_boot_watchdog({ idle_ms: 30 })
      let resolve_boot: (value: string) => void = () => undefined
      const boot = new Promise<string>((resolve) => { resolve_boot = resolve })
      // Tick every 10ms (< 30ms idle) for 90ms, then let the boot finish — a fixed
      // cap would have fired long ago; the idle watchdog must not.
      const ticker = setInterval(() => watchdog.tick(), 10)
      setTimeout(() => { clearInterval(ticker); resolve_boot('warm') }, 90)
      await expect(watchdog.guard(boot)).resolves.toBe('warm')
    })

    it('propagates a real rejection unchanged (and disarms)', async () => {
      const watchdog = create_boot_watchdog({ idle_ms: 50 })
      const boom = Object.assign(new Error('boom'), { code: 'internal' })
      await expect(watchdog.guard(Promise.reject(boom))).rejects.toBe(boom)
    })
  })

  describe(boot_retry_decision, () => {
    it('retries with exponential backoff while attempts remain', () => {
      expect(boot_retry_decision({ attempt: 0 })).toEqual({ will_retry: true, delay_ms: 500 })
      expect(boot_retry_decision({ attempt: 1 })).toEqual({ will_retry: true, delay_ms: 1000 })
    })
    it('stops retrying (and resigns) once the budget is spent', () => {
      expect(boot_retry_decision({ attempt: MAX_BOOT_RETRIES })).toEqual({ will_retry: false, delay_ms: 0 })
    })
  })

  describe(reelect_delay, () => {
    it('grows exponentially then caps at the max', () => {
      expect(reelect_delay({ attempt: 0 })).toBe(2_000)
      expect(reelect_delay({ attempt: 1 })).toBe(4_000)
      expect(reelect_delay({ attempt: 2 })).toBe(8_000)
      expect(reelect_delay({ attempt: 20 })).toBe(REELECT_MAX_MS)
    })
  })

  describe(read_boot_fault, () => {
    const KEY = '__LD_DB_BOOT_FAULT__'
    it('returns undefined when no flag is set (production)', () => {
      delete (globalThis as Record<string, unknown>)[KEY]
      expect(read_boot_fault()).toBeUndefined()
    })
    it('reads a valid flag', () => {
      ;(globalThis as Record<string, unknown>)[KEY] = { mode: 'hang', count: 2, timeout_ms: 1500 }
      expect(read_boot_fault()).toEqual({ mode: 'hang', count: 2, timeout_ms: 1500 })
      delete (globalThis as Record<string, unknown>)[KEY]
    })
    it('ignores a malformed flag', () => {
      ;(globalThis as Record<string, unknown>)[KEY] = { mode: 'nope' }
      expect(read_boot_fault()).toBeUndefined()
      delete (globalThis as Record<string, unknown>)[KEY]
    })
  })

  describe(apply_boot_fault, () => {
    it('no-ops without a fault', async () => {
      await expect(apply_boot_fault(undefined)).resolves.toBeUndefined()
    })
    it('throws on a "throw" fault', async () => {
      await expect(apply_boot_fault('throw')).rejects.toMatchObject({ code: 'boot_fault' })
    })
  })
}

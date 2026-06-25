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
/** Total boot attempts = 1 + MAX_BOOT_RETRIES before the tab resigns leadership. */
export const MAX_BOOT_RETRIES = 2
export const BOOT_RETRY_BASE_MS = 500

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

/** Should the spawning tab retry its own leader boot, and after how long? */
export function boot_retry_decision({ attempt }: { attempt: number }): { will_retry: boolean, delay_ms: number } {
  const will_retry = attempt < MAX_BOOT_RETRIES
  return { will_retry, delay_ms: will_retry ? BOOT_RETRY_BASE_MS * 2 ** attempt : 0 }
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

  describe(boot_retry_decision, () => {
    it('retries with exponential backoff while attempts remain', () => {
      expect(boot_retry_decision({ attempt: 0 })).toEqual({ will_retry: true, delay_ms: 500 })
      expect(boot_retry_decision({ attempt: 1 })).toEqual({ will_retry: true, delay_ms: 1000 })
    })
    it('stops retrying (and resigns) once the budget is spent', () => {
      expect(boot_retry_decision({ attempt: MAX_BOOT_RETRIES })).toEqual({ will_retry: false, delay_ms: 0 })
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

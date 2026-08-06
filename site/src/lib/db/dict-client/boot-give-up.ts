/**
 * PAGE-SESSION bounds on the dictionary boot ladder — the layer above
 * `worker/boot-recovery.ts`, which only bounds retries WITHIN one leader worker.
 *
 * WHY (2026-08-02, `.cron/log-reviews/2026-08-02.md` §1.3): an anonymous iPhone
 * visitor spent NINE AND A HALF MINUTES on `tutelo-saponi` watching an
 * indeterminate progress bar, writing 17 boot-failure rows, then opened a second
 * session and hit the same wall. The ladder was working exactly as designed —
 * `boot_retry_decision` bounds the attempts inside a worker (0→1→2), the tab then
 * resigns, re-elects on a capped backoff, and the NEW worker starts the ladder
 * again from zero. Bounded × unbounded = unbounded.
 *
 * So: bound the re-elections too, and when that budget is spent STOP and hand the
 * problem to a human-visible failure state (`dict-boot-progress.svelte.ts`) with a
 * reset-and-redownload action. Silence for nine minutes is the actual defect; a
 * clear "this didn't work, here's the button" in fifteen seconds is the fix.
 *
 * Also bounds the TELEMETRY: one tab once emitted 421 `dict_boot_recovery_exhausted`
 * rows over five hours (open branch 1 of
 * `.issues/dict-boot-persistent-opfs-recovery.md`). A failure that repeats says
 * nothing new after the first few rows, and the rows themselves cost a real user's
 * bandwidth on a device that is already struggling.
 */

/**
 * Re-elections allowed after the in-worker retries are spent, per page session.
 * With `REELECT_BASE_MS` 2 s doubling, 3 cycles ≈ 14 s of backoff plus the boot
 * attempts themselves — long enough to ride out a deploy window or a brief
 * offline blip, short enough that nobody watches a bar for minutes.
 */
export const MAX_BOOT_REELECTIONS = 3

/** Should the tab re-enter the election after resigning, or give up and surface the failure? */
export function boot_reelect_decision({ reelect_attempt }: { reelect_attempt: number }): { will_reelect: boolean } {
  return { will_reelect: reelect_attempt < MAX_BOOT_REELECTIONS }
}

/** Retryable (`leader_boot_failed`) rows emitted per dict per page session. */
export const MAX_BOOT_WARN_ROWS = 3
/** Terminal (`dict_boot_recovery_exhausted`) rows emitted per dict per page session. */
export const MAX_BOOT_TERMINAL_ROWS = 2

export interface BootLogCounts {
  warns: number
  terminals: number
}

/**
 * Whether this boot failure should ship a telemetry row, given what this page
 * session has already shipped for this dictionary. The give-up row
 * (`gave_up`) ALWAYS ships — it is the one row that says a person was left
 * stuck, and there can only ever be one per page session.
 */
export function decide_boot_failure_log({ will_retry, gave_up, counts }: {
  will_retry: boolean
  gave_up: boolean
  counts: BootLogCounts
}): { emit: boolean, message: 'leader_boot_failed' | 'dict_boot_recovery_exhausted' | 'dict_boot_gave_up' } {
  if (gave_up)
    return { emit: true, message: 'dict_boot_gave_up' }
  if (will_retry)
    return { emit: counts.warns < MAX_BOOT_WARN_ROWS, message: 'leader_boot_failed' }
  return { emit: counts.terminals < MAX_BOOT_TERMINAL_ROWS, message: 'dict_boot_recovery_exhausted' }
}

if (import.meta.vitest) {
  describe(boot_reelect_decision, () => {
    it('re-elects while the budget remains', () => {
      expect(boot_reelect_decision({ reelect_attempt: 0 })).toEqual({ will_reelect: true })
      expect(boot_reelect_decision({ reelect_attempt: MAX_BOOT_REELECTIONS - 1 })).toEqual({ will_reelect: true })
    })
    it('gives up once the budget is spent — the 9.5-minute lockout is what this bound exists to stop', () => {
      expect(boot_reelect_decision({ reelect_attempt: MAX_BOOT_REELECTIONS })).toEqual({ will_reelect: false })
      expect(boot_reelect_decision({ reelect_attempt: 40 })).toEqual({ will_reelect: false })
    })
  })

  describe(decide_boot_failure_log, () => {
    it('emits the first few retryable failures, then goes quiet', () => {
      expect(decide_boot_failure_log({ will_retry: true, gave_up: false, counts: { warns: 0, terminals: 0 } }))
        .toEqual({ emit: true, message: 'leader_boot_failed' })
      expect(decide_boot_failure_log({ will_retry: true, gave_up: false, counts: { warns: MAX_BOOT_WARN_ROWS, terminals: 0 } }))
        .toEqual({ emit: false, message: 'leader_boot_failed' })
    })

    it('emits the first terminal rows, then goes quiet (the 421-row tab)', () => {
      expect(decide_boot_failure_log({ will_retry: false, gave_up: false, counts: { warns: 3, terminals: 0 } }))
        .toEqual({ emit: true, message: 'dict_boot_recovery_exhausted' })
      expect(decide_boot_failure_log({ will_retry: false, gave_up: false, counts: { warns: 3, terminals: MAX_BOOT_TERMINAL_ROWS } }))
        .toEqual({ emit: false, message: 'dict_boot_recovery_exhausted' })
    })

    it('always emits the give-up row, whatever the counts', () => {
      expect(decide_boot_failure_log({ will_retry: false, gave_up: true, counts: { warns: 99, terminals: 99 } }))
        .toEqual({ emit: true, message: 'dict_boot_gave_up' })
    })
  })
}

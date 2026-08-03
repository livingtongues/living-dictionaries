import type { Mock } from 'vitest'
import type { BootFailure } from './instance'
import { create_db_client } from './db-client'
import { BOOT_RETRY_BASE_MS, MAX_BOOT_RETRIES } from './boot-recovery'
import { MAX_BOOT_REELECTIONS } from '../boot-give-up'
import { missing_build_artifact_reason } from '$lib/db/client/stale-build-artifact'

/**
 * These cover ONE property: a boot failure that retrying cannot possibly fix must
 * not enter the retry ladder. See `$lib/db/client/stale-build-artifact.ts` for the
 * 2026-07-29 incident (39 retries, 6 minutes, one locked-out signed-in editor).
 *
 * There is no `navigator` in the node test project, so `start_leader_election`
 * degrades to "always leader" and spawns immediately — exactly the path under test.
 */

const spawned: FakeWorker[] = []

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  terminated = false
  constructor(_url: URL, _options?: unknown) { spawned.push(this) }
  postMessage(): void { /* the init message — the fake never boots */ }
  terminate(): void { this.terminated = true }
}

const MISSING_ARTIFACT_MESSAGE = 'Failed to fetch dynamically imported module: https://livingdictionaries.app/_app/immutable/workers/chunks/DASUsDk6.js'

function start({ on_boot_failed }: { on_boot_failed: Mock }) {
  return create_db_client({
    instance_options: { dict_id: `d${spawned.length}-${Math.random().toString(36).slice(2)}`, has_editor_role: false, auth: {} },
    on_boot_failed: on_boot_failed as unknown as (info: BootFailure) => void,
    boot_failure_terminal_reason: ({ message }) => missing_build_artifact_reason({ message }),
  })
}

/**
 * Minimal Web Locks stand-in: grant immediately, release when `resign()` resolves
 * the held promise. Without it `start_leader_election` degrades to "always leader"
 * and `reacquire()` is a no-op, so no re-election cycle can be exercised.
 */
let saved_navigator: PropertyDescriptor | undefined
function stub_web_locks(): void {
  saved_navigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', {
    value: { locks: { request: (_name: string, _options: unknown, callback: () => Promise<void>) => Promise.resolve(callback()) } },
    configurable: true,
  })
}
function restore_navigator(): void {
  if (!saved_navigator)
    return
  Object.defineProperty(globalThis, 'navigator', saved_navigator)
  saved_navigator = undefined
}

describe(create_db_client, () => {
  beforeEach(() => {
    spawned.length = 0
    vi.useFakeTimers()
    ;(globalThis as { Worker?: unknown }).Worker = FakeWorker
  })
  afterEach(() => {
    vi.useRealTimers()
    delete (globalThis as { Worker?: unknown }).Worker
    restore_navigator()
  })

  test('a missing build artifact is TERMINAL — zero retries, no re-election', () => {
    const on_boot_failed = vi.fn()
    const client = start({ on_boot_failed })
    expect(spawned).toHaveLength(1)

    spawned[0].onmessage?.({ data: { type: 'boot_failed', message: MISSING_ARTIFACT_MESSAGE, last_stage: 'init' } })

    expect(on_boot_failed).toHaveBeenCalledTimes(1)
    expect(on_boot_failed.mock.calls[0][0]).toMatchObject({ will_retry: false, terminal_reason: 'missing_build_artifact' })
    expect(spawned[0].terminated).toBeTruthy()

    // The whole ladder plus the slow re-election backoff, fast-forwarded: nothing
    // may spawn again. This is the 39-retry loop that must never happen.
    vi.advanceTimersByTime(120_000)
    expect(spawned).toHaveLength(1)
    expect(on_boot_failed).toHaveBeenCalledTimes(1)

    client.destroy()
  })

  test('a genuinely retryable boot failure still runs the ladder', () => {
    const on_boot_failed = vi.fn()
    const client = start({ on_boot_failed })

    spawned[0].onmessage?.({ data: { type: 'boot_failed', message: 'leader boot stalled — no progress for 20000ms', last_stage: 'snapshot_fetch' } })
    expect(on_boot_failed.mock.calls[0][0]).toMatchObject({ will_retry: true, terminal_reason: null })

    vi.advanceTimersByTime(BOOT_RETRY_BASE_MS)
    expect(spawned).toHaveLength(2)

    client.destroy()
  })

  test('a worker whose SCRIPT cannot load reports terminal instead of wedging silently', () => {
    const on_boot_failed = vi.fn()
    const client = start({ on_boot_failed })

    // A failed worker-script fetch fires `error` on the Worker and posts nothing.
    // Before this handler existed there was no `boot_failed`, no `ready`, and the
    // lock stayed held — a permanent silent wedge.
    spawned[0].onerror?.({ message: 'Failed to load module script' })

    expect(on_boot_failed).toHaveBeenCalledTimes(1)
    expect(on_boot_failed.mock.calls[0][0]).toMatchObject({ will_retry: false, terminal_reason: 'missing_build_artifact' })
    vi.advanceTimersByTime(120_000)
    expect(spawned).toHaveLength(1)

    client.destroy()
  })

  test('the give-up ladder is bounded ACROSS re-elections — a permanently unopenable file cannot spin forever', () => {
    // The other tests run on the degraded "always leader" election (no Web Locks),
    // where `reacquire()` is a no-op — so the re-election cycle this bound governs
    // needs a lock that actually grants (`stub_web_locks`, undone in afterEach).
    stub_web_locks()

    const on_boot_failed = vi.fn()
    const client = start({ on_boot_failed })

    // The 2026-08-02 fingerprint: `sqlite3_open_v2` at `opfs_open`, every attempt,
    // forever. Fail every worker the client spawns and let all timers run out.
    for (let tick = 0; tick < 200; tick++) {
      const worker = spawned[spawned.length - 1]
      if (worker && !worker.terminated)
        worker.onmessage?.({ data: { type: 'boot_failed', message: 'sqlite3_open_v2', last_stage: 'opfs_open' } })
      vi.advanceTimersByTime(5_000)
    }

    // Bounded at (1 + MAX_BOOT_REELECTIONS) cycles × (1 + MAX_BOOT_RETRIES) attempts.
    // Before this bound the same loop ran until the PERSON gave up — 17 rows over
    // 9.5 minutes for one iPhone visitor on `tutelo-saponi`.
    expect(spawned).toHaveLength((1 + MAX_BOOT_REELECTIONS) * (1 + MAX_BOOT_RETRIES))
    expect(on_boot_failed.mock.calls[on_boot_failed.mock.calls.length - 1][0]).toMatchObject({ will_retry: false, will_reelect: false, reelect_attempt: MAX_BOOT_REELECTIONS })
    // Exactly ONE give-up — it is what flips the UI into its failure state.
    expect(on_boot_failed.mock.calls.filter(([info]) => info.will_reelect === false)).toHaveLength(1)

    client.destroy()
  })

  test('one boot outcome per worker — a follow-up `boot_failed` after `error` is ignored', () => {
    const on_boot_failed = vi.fn()
    const client = start({ on_boot_failed })

    spawned[0].onerror?.({ message: 'Failed to load module script' })
    spawned[0].onmessage?.({ data: { type: 'boot_failed', message: MISSING_ARTIFACT_MESSAGE } })

    expect(on_boot_failed).toHaveBeenCalledTimes(1)
    client.destroy()
  })
})

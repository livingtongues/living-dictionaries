/**
 * Extra context attached to dictionary boot-failure telemetry.
 *
 * WHY STORAGE (2026-08-02 §1.3): four visitors failed to boot a dictionary last
 * night, every one of them `sqlite3_open_v2` at stage `opfs_open` — the file never
 * opens. The obvious first question is "is this device simply full?", and we
 * collected NOTHING that could answer it. `navigator.storage.estimate()` is one
 * cheap call and it turns "flukes or full devices?" from a guess into a query.
 *
 * WHY VISIBILITY (open branch 1 of `.issues/dict-boot-persistent-opfs-recovery.md`):
 * proving a failure hit a person in the FOREGROUND, rather than a forgotten
 * background tab, previously took a session replay. `was_hidden` latches for the
 * page session, so a row can say "this tab was backgrounded at some point" without
 * one.
 */

export interface StorageDiagnostics {
  /** Bytes the origin may use, per the browser's own estimate. */
  quota_bytes: number | null
  /** Bytes the origin is estimated to be using. */
  usage_bytes: number | null
  /** Usage as a whole-percent of quota — the "is this device full?" number. */
  usage_pct: number | null
  /** Whether this origin's storage is exempt from eviction (`navigator.storage.persisted()`). */
  persisted: boolean | null
  /** Set when the browser exposes no Storage Manager (or it threw) — the estimate is simply unknown. */
  unavailable?: true
}

export interface BootFailureContext {
  visibility: string | null
  /** True once this page session has been backgrounded at any point. */
  was_hidden: boolean
  storage: StorageDiagnostics
}

const UNAVAILABLE: StorageDiagnostics = { quota_bytes: null, usage_bytes: null, usage_pct: null, persisted: null, unavailable: true }

export async function get_storage_diagnostics(): Promise<StorageDiagnostics> {
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
    if (!storage?.estimate)
      return UNAVAILABLE
    const [estimate, persisted] = await Promise.all([
      storage.estimate(),
      storage.persisted ? storage.persisted().catch(() => null) : Promise.resolve(null),
    ])
    const quota_bytes = typeof estimate.quota === 'number' ? estimate.quota : null
    const usage_bytes = typeof estimate.usage === 'number' ? estimate.usage : null
    return {
      quota_bytes,
      usage_bytes,
      usage_pct: quota_bytes && usage_bytes !== null ? Math.round((usage_bytes / quota_bytes) * 100) : null,
      persisted,
    }
  } catch {
    return UNAVAILABLE
  }
}

/**
 * Page-session latch: flips true the first time the document is hidden and never
 * flips back. Armed lazily by `collect_boot_failure_context` so nothing is wired
 * up on pages that never open a dictionary.
 */
let was_hidden = false
let latch_armed = false

function arm_hidden_latch(): void {
  if (latch_armed || typeof document === 'undefined')
    return
  latch_armed = true
  if (document.visibilityState === 'hidden')
    was_hidden = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden')
      was_hidden = true
  })
}

export async function collect_boot_failure_context(): Promise<BootFailureContext> {
  arm_hidden_latch()
  return {
    visibility: typeof document === 'undefined' ? null : document.visibilityState,
    was_hidden,
    storage: await get_storage_diagnostics(),
  }
}

/** Test-only: reset the page-session latch. */
export function _reset_hidden_latch_for_tests(): void {
  was_hidden = false
  latch_armed = false
}

if (import.meta.vitest) {
  describe(get_storage_diagnostics, () => {
    it('reports unavailable rather than throwing when there is no Storage Manager', async () => {
      const original = globalThis.navigator
      Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true })
      expect(await get_storage_diagnostics()).toEqual(UNAVAILABLE)
      Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true })
    })

    it('computes usage_pct from the estimate', async () => {
      const original = globalThis.navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: { storage: { estimate: () => Promise.resolve({ quota: 1000, usage: 250 }), persisted: () => Promise.resolve(true) } },
        configurable: true,
      })
      expect(await get_storage_diagnostics()).toEqual({ quota_bytes: 1000, usage_bytes: 250, usage_pct: 25, persisted: true })
      Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true })
    })

    it('survives an estimate() that throws', async () => {
      const original = globalThis.navigator
      Object.defineProperty(globalThis, 'navigator', {
        value: { storage: { estimate: () => { throw new Error('nope') } } },
        configurable: true,
      })
      expect(await get_storage_diagnostics()).toEqual(UNAVAILABLE)
      Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true })
    })
  })
}

import type { Mock } from 'vitest'
import type { ReloadGuard } from '$lib/db/client/client-behind-recovery'
import type { TranslateFunction } from '$lib/i18n/types'
import type { StaleBundleRecoveryDeps } from './stale-bundle-recovery'
import { recover_from_stale_bundle } from './stale-bundle-recovery'
import { RELOAD_WINDOW_MS } from '$lib/db/client/client-behind-recovery'
import { MISSING_BUILD_ARTIFACT_REASON } from '$lib/db/client/stale-build-artifact'
import { log_event } from '$lib/debug/remote-log'
import { toast } from '$lib/state/toast.svelte'

vi.mock('$lib/debug/remote-log', () => ({ log_event: vi.fn() }))
vi.mock('$lib/state/toast.svelte', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }))

const t: TranslateFunction = ((key: string) => key) as TranslateFunction

const failure = {
  dict_id: 'algonquin',
  boot_message: 'Failed to fetch dynamically imported module: /_app/immutable/workers/chunks/DASUsDk6.js',
  reason: MISSING_BUILD_ARTIFACT_REASON,
  t,
}

function make_deps(overrides: Partial<StaleBundleRecoveryDeps> = {}) {
  let guard: ReloadGuard | null = null
  const visible_callbacks: (() => void)[] = []
  const deps: StaleBundleRecoveryDeps = {
    reload: vi.fn(),
    read_guard: () => guard,
    write_guard: (next) => { guard = next },
    now: () => 1_000,
    is_visible: () => true,
    on_visible: (callback) => { visible_callbacks.push(callback); return () => undefined },
    ...overrides,
  }
  return { deps, show_tab: () => { for (const callback of visible_callbacks.splice(0)) callback() } }
}

function logged(message: string) {
  return (log_event as unknown as Mock).mock.calls.map(([entry]) => entry).filter(entry => entry.message === message)
}

describe(recover_from_stale_bundle, () => {
  beforeEach(() => vi.clearAllMocks())

  test('reloads ONCE onto the current build instead of retrying', () => {
    const { deps } = make_deps()
    expect(recover_from_stale_bundle(failure, deps)).toBe('reloaded')
    expect(deps.reload).toHaveBeenCalledTimes(1)

    const [row] = logged('stale_bundle_reload')
    expect(row.level).toBe('warn')
    expect(row.context.dict_id).toBe('algonquin')
    expect(row.context.reason).toBe(MISSING_BUILD_ARTIFACT_REASON)
    // `app_version` is the bundle we reloaded AWAY from — a next session_start
    // carrying the same value means the reload re-served a stale bundle.
    expect(row.context).toHaveProperty('app_version')
    expect(toast).not.toHaveBeenCalled()
  })

  test('a recurrence inside the guard window is TERMINAL — toast, no reload loop', () => {
    const { deps } = make_deps()
    recover_from_stale_bundle(failure, deps)
    expect(recover_from_stale_bundle(failure, deps)).toBe('gave-up')

    // Still exactly one reload: the point of the rule is once, not N times.
    expect(deps.reload).toHaveBeenCalledTimes(1)
    expect(logged('stale_bundle_reload_gave_up')[0].level).toBe('error')
    expect((toast as unknown as Mock).mock.calls[0][0]).toBe('misc.app_update_needed')
  })

  test('a later genuine deploy, past the window, gets its own single reload', () => {
    let clock = 1_000
    const { deps } = make_deps({ now: () => clock })
    recover_from_stale_bundle(failure, deps)
    clock += RELOAD_WINDOW_MS
    expect(recover_from_stale_bundle(failure, deps)).toBe('reloaded')
    expect(deps.reload).toHaveBeenCalledTimes(2)
  })

  test('a HIDDEN tab is never reloaded behind the user\'s back (2026-07-09 zombie-tab ruling)', () => {
    let visible = false
    const { deps, show_tab } = make_deps({ is_visible: () => visible })

    expect(recover_from_stale_bundle(failure, deps)).toBe('deferred')
    expect(deps.reload).not.toHaveBeenCalled()
    expect(logged('stale_bundle_reload_deferred')).toHaveLength(1)

    // …and it still gets its full one-shot budget when the person comes back.
    visible = true
    show_tab()
    expect(deps.reload).toHaveBeenCalledTimes(1)
    expect(logged('stale_bundle_reload')).toHaveLength(1)
  })

  test('every outcome emits exactly one terminal row, so the rule is measurable', () => {
    const { deps } = make_deps()
    recover_from_stale_bundle(failure, deps)
    recover_from_stale_bundle(failure, deps)
    const terminal = (log_event as unknown as Mock).mock.calls
      .map(([entry]) => entry.message)
      .filter((message: string) => message.startsWith('stale_bundle_reload'))
    expect(terminal).toEqual(['stale_bundle_reload', 'stale_bundle_reload_gave_up'])
  })
})

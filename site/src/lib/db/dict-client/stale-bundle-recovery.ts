import type { ReloadGuard } from '$lib/db/client/client-behind-recovery'
import type { TranslateFunction } from '$lib/i18n/types'
import { decide_client_behind_recovery } from '$lib/db/client/client-behind-recovery'
import { STALE_BUNDLE_GUARD_KEY } from '$lib/db/client/stale-build-artifact'
import { log_event } from '$lib/debug/remote-log'
import { toast } from '$lib/state/toast.svelte'
import { version } from '$app/environment'

/**
 * The action half of the reload-once rule (the diagnosis half — and the full
 * rationale — is `$lib/db/client/stale-build-artifact.ts`).
 *
 * Called when a dictionary's leader worker died asking for a build artifact the
 * server has deleted. Retrying cannot help, so instead of burning the boot ladder:
 *
 *   1. FOREGROUND ONLY — a hidden tab waits for `visibilitychange` rather than
 *      reloading behind the user's back (standing decision 2026-07-09).
 *   2. ONE reload per guard window, sharing the proven `decide_client_behind_recovery`
 *      policy under its own sessionStorage key.
 *   3. If it recurs inside the window the reload did NOT pick up newer code (stale
 *      service worker or CDN) — stop, and offer a manual reload toast.
 *
 * EVERY branch emits exactly one terminal telemetry row, because "did the rule
 * actually rescue people?" has to be answerable from `client_logs`:
 *   `stale_bundle_reload`          — we reloaded onto the current build.
 *   `stale_bundle_reload_deferred` — hidden tab; armed, will reload when shown.
 *   `stale_bundle_reload_gave_up`  — reloading already failed; the user is stuck
 *                                    and is looking at the toast.
 */

export interface StaleBundleRecoveryDeps {
  reload: () => void
  read_guard: () => ReloadGuard | null
  write_guard: (guard: ReloadGuard) => void
  now: () => number
  /** `undefined` where there's no document (tests, SSR) — treated as visible. */
  is_visible: () => boolean
  /** Run `callback` the next time the document becomes visible; returns an unsubscribe. */
  on_visible: (callback: () => void) => () => void
}

function session_storage_guard(): Pick<StaleBundleRecoveryDeps, 'read_guard' | 'write_guard'> {
  return {
    read_guard: () => {
      try {
        const raw = sessionStorage.getItem(STALE_BUNDLE_GUARD_KEY)
        return raw ? JSON.parse(raw) as ReloadGuard : null
      } catch {
        return null // unavailable or malformed — treat as no prior reload
      }
    },
    write_guard: (guard) => {
      try { sessionStorage.setItem(STALE_BUNDLE_GUARD_KEY, JSON.stringify(guard)) } catch { /* ignore */ }
    },
  }
}

const default_deps: StaleBundleRecoveryDeps = {
  reload: () => location.reload(),
  ...session_storage_guard(),
  now: () => Date.now(),
  is_visible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  on_visible: (callback) => {
    const handler = () => {
      if (document.visibilityState !== 'hidden') {
        document.removeEventListener('visibilitychange', handler)
        callback()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  },
}

export type StaleBundleOutcome = 'reloaded' | 'deferred' | 'gave-up'

export function recover_from_stale_bundle({ dict_id, boot_message, reason, t }: {
  dict_id: string
  boot_message: string
  /** The classifier's terminal reason, carried into telemetry. */
  reason: string
  t: TranslateFunction
}, overrides: Partial<StaleBundleRecoveryDeps> = {}): StaleBundleOutcome {
  const deps = { ...default_deps, ...overrides }
  const context = { dict_id, boot_message, reason, app_version: version }

  const decision = decide_client_behind_recovery({ stored: deps.read_guard(), now: deps.now() })
  if (decision.action !== 'reload') {
    // The reload already happened and we're right back here — the current build is
    // not what this tab is being served (stale SW/CDN), so reloading again just
    // loops. Terminal: tell the person, and make it countable.
    log_event({ level: 'error', message: 'stale_bundle_reload_gave_up', context })
    toast(t('misc.app_update_needed'), { action: { label: t('misc.reload'), callback: () => deps.reload() }, dismiss_label: t('misc.close') })
    return 'gave-up'
  }

  if (!deps.is_visible()) {
    // Explicitly NOT the declined zombie-tab behaviour: a background tab is left
    // alone until the person comes back to it. No guard is written yet, so the
    // deferred reload still gets the full one-shot budget when it fires.
    log_event({ level: 'warn', message: 'stale_bundle_reload_deferred', context })
    deps.on_visible(() => { recover_from_stale_bundle({ dict_id, boot_message, reason, t }, overrides) })
    return 'deferred'
  }

  deps.write_guard(decision.next)
  // `app_version` here is the bundle we are reloading AWAY from. If the very next
  // session_start still carries it, the reload re-served a stale bundle rather than
  // picking up the deploy. The pagehide beacon flushes this before teardown.
  log_event({ level: 'warn', message: 'stale_bundle_reload', context })
  deps.reload()
  return 'reloaded'
}

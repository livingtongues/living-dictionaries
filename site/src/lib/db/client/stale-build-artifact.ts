/**
 * THE RELOAD-ONCE RULE (portfolio-wide, approved 2026-07-31).
 *
 * > When the missing thing is a build artifact the server has DELETED, retrying is
 * > provably useless — reload ONCE onto the current build instead of retrying N times.
 *
 * WHY IT EXISTS. On 2026-07-29, 22:29–22:35 UTC, a signed-in contributor opened the
 * private `algonquin` dictionary. Her tab predated a deploy, so the leader worker's
 * `await import('../dict-instance')` asked for
 * `/_app/immutable/workers/chunks/DASUsDk6.js` — a hashed chunk the deploy had
 * already removed from the server. The app then ran its boot ladder against it: 39
 * `leader_boot_failed`, 14 `dict_boot_recovery_exhausted`, one failed initial sync,
 * and SIX MINUTES locked out of her own dictionary. Not one of those retries could
 * ever have succeeded: `/_app/immutable/*` is content-hashed, so a 404 there means
 * the file is gone, permanently, for this bundle. Only loading the CURRENT build can
 * help — and the app already does exactly that for `schema_outdated`.
 *
 * WHY THIS IS NOT THE ZOMBIE-TAB RULING (standing decision 2026-07-09: no
 * forced-reload mechanism for stale background tabs producing sync-failure storms).
 * That ruling protects a forgotten background tab belonging to nobody's active work.
 * This fires only for a FOREGROUND tab (see `reload_when_visible` in
 * `../dict-client/stale-bundle-recovery.ts`) whose load can NEVER succeed, and it
 * reloads exactly once per guard window before falling back to a toast.
 *
 * The classifier is pure and lives apart from the leader-worker harness on purpose:
 * `dict-client/worker/` is copy-paste-shared with house (see house's
 * `$lib/db/worker/PARITY.md`, whose test rejects unclassified files in that folder),
 * so app-specific policy is INJECTED into `db-client.ts`, never added to it.
 */

/**
 * Every browser's phrasing for "the module script you asked for did not load".
 * Matched case-insensitively as substrings of the boot failure message.
 *
 * These are deliberately only the MODULE/ASSET-fetch family. A `boot_timeout`, an
 * OPFS failure or a snapshot stall are all genuinely retryable and must keep the
 * existing ladder — misclassifying one of those would turn a transient hiccup into
 * a page reload.
 */
export const MISSING_BUILD_ARTIFACT_PATTERNS = [
  'failed to fetch dynamically imported module', // Chrome / Edge
  'error loading dynamically imported module', //  Firefox
  'importing a module script failed', //            Safari
  'failed to load module script', //                Chrome (404 served as HTML)
  'unable to preload css for', //                   Vite's asset preloader
] as const

/** The single reason string that means "reloading is the only cure". */
export const MISSING_BUILD_ARTIFACT_REASON = 'missing_build_artifact'

/**
 * Is this boot failure provably unfixable by retrying? Returns the terminal reason,
 * or `null` when the normal retry ladder should run.
 *
 * `online: false` deliberately vetoes the classification. Offline produces the very
 * same message, but there the artifact may well still exist on the server — so
 * retrying IS plausible, and a reload would only trade a spinner for the browser's
 * offline page.
 */
export function missing_build_artifact_reason({ message, online = true }: {
  message: string | undefined | null
  online?: boolean
}): string | null {
  if (!message || !online)
    return null
  const haystack = message.toLowerCase()
  return MISSING_BUILD_ARTIFACT_PATTERNS.some(pattern => haystack.includes(pattern))
    ? MISSING_BUILD_ARTIFACT_REASON
    : null
}

/**
 * sessionStorage key for the one-shot reload guard. Deliberately SEPARATE from
 * `CLIENT_BEHIND_GUARD_KEY`: a schema-outdated reload and a stale-bundle reload are
 * different diagnoses, and sharing one budget would let either silently consume the
 * other's single attempt.
 */
export const STALE_BUNDLE_GUARD_KEY = 'stale_bundle_reload_at'

if (import.meta.vitest) {
  describe(missing_build_artifact_reason, () => {
    test('classifies every browser\'s module-load phrasing', () => {
      const messages = [
        'Failed to fetch dynamically imported module: https://livingdictionaries.app/_app/immutable/workers/chunks/DASUsDk6.js',
        'error loading dynamically imported module: /_app/immutable/chunks/x.js',
        'Importing a module script failed.',
        'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".',
        'Unable to preload CSS for /_app/immutable/assets/x.css',
      ]
      for (const message of messages)
        expect(missing_build_artifact_reason({ message })).toBe(MISSING_BUILD_ARTIFACT_REASON)
    })

    test('leaves genuinely retryable boot failures alone', () => {
      const retryable = [
        'leader boot stalled — no progress for 20000ms',
        'leader boot timed out after 12000ms',
        'SQLITE_CANTOPEN: unable to open database file',
        'snapshot fetch failed with 502',
        'unknown',
      ]
      for (const message of retryable)
        expect(missing_build_artifact_reason({ message })).toBe(null)
    })

    test('an empty or missing message is never terminal', () => {
      expect(missing_build_artifact_reason({ message: undefined })).toBe(null)
      expect(missing_build_artifact_reason({ message: null })).toBe(null)
      expect(missing_build_artifact_reason({ message: '' })).toBe(null)
    })

    test('offline vetoes it — the artifact may still exist, so retrying is plausible', () => {
      const message = 'Failed to fetch dynamically imported module: /_app/immutable/x.js'
      expect(missing_build_artifact_reason({ message, online: false })).toBe(null)
      expect(missing_build_artifact_reason({ message, online: true })).toBe(MISSING_BUILD_ARTIFACT_REASON)
    })
  })
}

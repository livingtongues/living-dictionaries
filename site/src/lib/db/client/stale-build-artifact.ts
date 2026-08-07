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

/* ── PROBE BEFORE YOU ACCUSE ──────────────────────────────────────────────────
 *
 * The rule above was written when a failed chunk load really was a deleted file
 * BY CONSTRUCTION. The immutable-asset ARCHIVE changed that base rate: the
 * previous builds' assets are served for 30 days, so a bare "module failed to
 * load" is now much more often a dropped connection than a deleted file. On
 * 2026-08-06 the machinery fired 19 terminal verdicts, and the reviewer fetched
 * the blamed files: `200`, `x-immutable-archive: hit`. Only 3 rows in the whole
 * family that day were genuine (log review §1.4 — third night on the list, first
 * with a receipt).
 *
 * A browser event cannot tell the two apart. One HEAD request can. So: record
 * what failed, ask the server whether it is still there, and only THEN accuse.
 */

/** A probe must never delay recovery — a slow answer is treated as no answer. */
export const ARTIFACT_PROBE_TIMEOUT_MS = 3000

/** What the server said about the artifact we were blamed for not loading. */
export type ProbeVerdict = 'missing' | 'present' | 'unknown'

/**
 * Only an explicit "this is not here" is `missing`. Anything else the server
 * managed to answer proves the file is reachable, and a probe that could not
 * complete at all is itself evidence of a network fault — never of a deletion.
 */
export function probe_verdict_from_status(status: number | null | undefined): ProbeVerdict {
  if (status === null || status === undefined)
    return 'unknown'
  if (status === 404 || status === 410)
    return 'missing'
  return 'present'
}

/** The failing URL named inside a browser's message, when it names one at all. */
export function url_from_boot_message(message: string | null | undefined): string | null {
  if (!message)
    return null
  const match = message.match(/https?:\/\/[^\s'")]+|\/_app\/[^\s'")]+/)
  return match ? match[0] : null
}

/**
 * One HEAD against the artifact. Returns the status, or `null` if the request
 * could not be completed (offline, aborted, blocked, CORS-opaque).
 *
 * HEAD matters twice over: it is cheap, and LD's service worker only intercepts
 * GET (`service-worker.ts`), so a HEAD always reaches the real network instead of
 * being answered from the very cache whose staleness is in question.
 */
export async function head_probe_artifact({ url, fetch_impl = fetch, timeout_ms = ARTIFACT_PROBE_TIMEOUT_MS }: {
  url: string
  fetch_impl?: typeof fetch
  timeout_ms?: number
}): Promise<number | null> {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), timeout_ms) : null
  try {
    const response = await fetch_impl(url, { method: 'HEAD', cache: 'no-store', signal: controller?.signal })
    return response.status
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface BootFailureEvidence {
  message: string | undefined | null
  /** The worker script the browser refused to load — the `onerror` path's only clue. */
  script_url?: string | null
  online?: boolean
  /** Injected for tests; production probes the network. */
  probe?: (url: string) => Promise<number | null>
}

/**
 * THE verdict, evidence-first. Returns the terminal reason or `null` (run the
 * normal retry ladder).
 *
 * The ladder of certainty, most certain first:
 *   1. OFFLINE → never terminal. Unchanged, and still the strongest veto.
 *   2. We have a URL → PROBE IT. `404`/`410` is proof of deletion; any other
 *      answer proves the file is reachable and the fault was the network; a
 *      probe that cannot complete is itself a network fault. This is the case
 *      that produced tonight's 19 false verdicts, and it is now decided by
 *      evidence rather than by a comment.
 *   3. No URL to probe (Safari refuses to name the module; a worker `error`
 *      event carries nothing) → fall back to the message patterns exactly as
 *      before. We are no worse off than yesterday where we cannot do better,
 *      and the reload-once rescue still reaches those people.
 */
export async function classify_boot_failure({ message, script_url, online = true, probe }: BootFailureEvidence): Promise<{
  reason: string | null
  probed_url: string | null
  probe_status: number | null
  verdict: ProbeVerdict
}> {
  if (!online)
    return { reason: null, probed_url: null, probe_status: null, verdict: 'unknown' }

  const url = script_url || url_from_boot_message(message)
  if (!url) {
    return {
      reason: missing_build_artifact_reason({ message, online }),
      probed_url: null,
      probe_status: null,
      verdict: 'unknown',
    }
  }

  const probe_impl = probe ?? ((probe_url: string) => head_probe_artifact({ url: probe_url }))
  const status = await probe_impl(url)
  const verdict = probe_verdict_from_status(status)
  return {
    reason: verdict === 'missing' ? MISSING_BUILD_ARTIFACT_REASON : null,
    probed_url: url,
    probe_status: status,
    verdict,
  }
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

  describe(url_from_boot_message, () => {
    test('extracts the absolute URL Chrome names', () => {
      expect(url_from_boot_message('Failed to fetch dynamically imported module: https://livingdictionaries.app/_app/immutable/workers/chunks/DASUsDk6.js'))
        .toBe('https://livingdictionaries.app/_app/immutable/workers/chunks/DASUsDk6.js')
    })

    test('extracts a root-relative build path', () => {
      expect(url_from_boot_message('error loading dynamically imported module: /_app/immutable/chunks/x.js'))
        .toBe('/_app/immutable/chunks/x.js')
    })

    test('Safari names nothing — and we must not invent one', () => {
      expect(url_from_boot_message('Importing a module script failed.')).toBe(null)
      expect(url_from_boot_message(null)).toBe(null)
    })
  })

  describe(probe_verdict_from_status, () => {
    test('only an explicit not-here is a deletion', () => {
      expect(probe_verdict_from_status(404)).toBe('missing')
      expect(probe_verdict_from_status(410)).toBe('missing')
    })

    test('any answer at all proves the file is reachable', () => {
      expect(probe_verdict_from_status(200)).toBe('present')
      expect(probe_verdict_from_status(304)).toBe('present')
      // A 500/503 is the SERVER struggling, not the file being gone — reloading
      // onto "the current build" cannot help, so this must not be terminal.
      expect(probe_verdict_from_status(500)).toBe('present')
      expect(probe_verdict_from_status(503)).toBe('present')
    })

    test('no answer is no evidence', () => {
      expect(probe_verdict_from_status(null)).toBe('unknown')
      expect(probe_verdict_from_status(undefined)).toBe('unknown')
    })
  })

  describe(classify_boot_failure, () => {
    const script_url = 'https://livingdictionaries.app/_app/immutable/workers/leader-worker.DFfJPNRA.js'

    test('THE 2026-08-06 INCIDENT: a worker script that answers 200 is NOT a deleted artifact', async () => {
      const result = await classify_boot_failure({ message: '', script_url, probe: () => Promise.resolve(200) })
      expect(result.reason).toBe(null)
      expect(result.verdict).toBe('present')
      expect(result.probed_url).toBe(script_url)
      expect(result.probe_status).toBe(200)
    })

    test('a 404 IS proof, and stays terminal', async () => {
      const result = await classify_boot_failure({ message: '', script_url, probe: () => Promise.resolve(404) })
      expect(result.reason).toBe(MISSING_BUILD_ARTIFACT_REASON)
      expect(result.verdict).toBe('missing')
    })

    test('a probe that cannot complete is a network fault, never a deletion', async () => {
      const result = await classify_boot_failure({ message: '', script_url, probe: () => Promise.resolve(null) })
      expect(result.reason).toBe(null)
      expect(result.verdict).toBe('unknown')
    })

    test('probes the URL named INSIDE the message when there is no script_url', async () => {
      const probed: string[] = []
      const result = await classify_boot_failure({
        message: 'Failed to fetch dynamically imported module: /_app/immutable/chunks/BAcWumQH.js',
        probe: (url) => { probed.push(url); return Promise.resolve(404) },
      })
      expect(probed).toEqual(['/_app/immutable/chunks/BAcWumQH.js'])
      expect(result.reason).toBe(MISSING_BUILD_ARTIFACT_REASON)
    })

    test('offline never probes and never accuses', async () => {
      let probed = false
      const result = await classify_boot_failure({ message: '', script_url, online: false, probe: () => { probed = true; return Promise.resolve(404) } })
      expect(probed).toBe(false)
      expect(result.reason).toBe(null)
    })

    test('nothing to probe falls back to the message patterns (Safari keeps its rescue)', async () => {
      let probed = false
      const probe = () => { probed = true; return Promise.resolve(404) }
      expect((await classify_boot_failure({ message: 'Importing a module script failed.', probe })).reason).toBe(MISSING_BUILD_ARTIFACT_REASON)
      expect((await classify_boot_failure({ message: 'leader boot timed out after 12000ms', probe })).reason).toBe(null)
      expect(probed).toBe(false)
    })
  })

  describe(head_probe_artifact, () => {
    test('returns the status of a completed probe', async () => {
      const calls: [string, RequestInit | undefined][] = []
      const fetch_impl = ((url: string, init?: RequestInit) => {
        calls.push([url, init])
        return Promise.resolve({ status: 404 } as Response)
      }) as unknown as typeof fetch
      expect(await head_probe_artifact({ url: '/_app/immutable/x.js', fetch_impl })).toBe(404)
      expect(calls[0][0]).toBe('/_app/immutable/x.js')
      // HEAD is load-bearing: the service worker only intercepts GET, so this
      // reaches the network instead of the cache under suspicion.
      expect(calls[0][1].method).toBe('HEAD')
      expect(calls[0][1].cache).toBe('no-store')
    })

    test('a throwing/aborted probe answers null rather than propagating', async () => {
      const fetch_impl = (() => Promise.reject(new Error('Failed to fetch'))) as unknown as typeof fetch
      expect(await head_probe_artifact({ url: '/_app/immutable/x.js', fetch_impl })).toBe(null)
    })

    test('a hanging probe gives up at the timeout instead of delaying recovery', async () => {
      const fetch_impl = ((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })) as unknown as typeof fetch
      expect(await head_probe_artifact({ url: '/_app/immutable/x.js', fetch_impl, timeout_ms: 5 })).toBe(null)
    })
  })
}

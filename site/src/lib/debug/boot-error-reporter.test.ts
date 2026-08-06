import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The boot-error reporter lives as an inline `<script>` in `app.html` — nothing
 * imports it, so nothing else would notice if it were deleted, renamed, or
 * quietly broken by an editor pass. It is also a two-file contract: the inline
 * hook goes silent only because `init_remote_logging()` sets the SAME window
 * flag. This test guards both, because the failure mode is invisible: a broken
 * reporter looks exactly like "no outages happened".
 *
 * Behaviour itself is verified end-to-end against a real production build (both
 * outage shapes → exactly one `boot_error` row) — see
 * `.issues/boot-error-reporter-report.md`.
 */

const app_html = readFileSync(fileURLToPath(new URL('../../app.html', import.meta.url)), 'utf8')
const remote_log = readFileSync(fileURLToPath(new URL('./remote-log.ts', import.meta.url)), 'utf8')

const DISARM_FLAG = '__boot_reporter_off'

const REPORTER_MARKER = '// Boot-error reporter'

/** The reporter's executable lines only (comments stripped). */
function reporter_code(): string {
  expect(app_html).toContain(REPORTER_MARKER)
  const start = app_html.indexOf(REPORTER_MARKER)
  const end = app_html.indexOf('</script>', start)
  return app_html.slice(start, end)
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n')
}

describe('boot-error reporter (inline in app.html)', () => {
  test('listens on BOTH global channels', () => {
    // Error-only would miss every real outage: kit boots inside
    // `import().then()`, so a failed chunk arrives as a rejection.
    expect(app_html).toContain(`window.addEventListener('error'`)
    expect(app_html).toContain(`window.addEventListener('unhandledrejection'`)
  })

  test('beacons a payload `/api/log` actually parses, to a RELATIVE url', () => {
    // `extract_single_entry` in routes/api/log/+server.ts drops anything without
    // BOTH `level` and `message`, so those two are the contract.
    expect(app_html).toContain(`navigator.sendBeacon('/api/log'`)
    expect(app_html).toContain(`level: 'error'`)
    expect(app_html).toContain(`message: 'boot_error'`)
    // A Blob typed application/json so the endpoint's `request.json()` parses it
    // (same reason `send_log_beacon` does it).
    expect(app_html).toContain('application/json')
    // Relative on purpose: an absolute host baked at build time is the wrong
    // origin for a preview/staging server — and for the very host that is down.
    expect(app_html).not.toContain('sendBeacon(\'https://')
  })

  test('is one-shot across both channels', () => {
    // The `__sveltekit_<hash>` outage shape fires TWICE; one row per page load.
    const fired_assignments = app_html.match(/fired = true/g) ?? []
    expect(fired_assignments).toHaveLength(1)
    expect(app_html).toContain('if (fired || window.__boot_reporter_off)')
  })

  test('reports the build the visitor is running, ignoring kit fixed globals', () => {
    // `app_version` is what makes a stale-bundle boot failure attributable to a
    // build. `__sveltekit_sw` / `__sveltekit_dev` are FIXED names, not stamps —
    // the same exclusion scripts/check-build-version.mjs makes.
    expect(app_html).toContain('app_version: version_hash()')
    expect(app_html).toContain(`indexOf('__sveltekit_')`)
    expect(app_html).toContain(`name !== 'sw' && name !== 'dev'`)
  })

  test('carries no import and nothing that needs a modern engine', () => {
    // It has to run when the bundle is the thing that broke — including on the
    // oldest browser that reaches us.
    const code = reporter_code()
    expect(code).not.toContain('import ')
    expect(code).not.toContain('=>')
    expect(code).not.toContain('const ')
    expect(code).not.toContain('let ')
    expect(code).not.toContain('`')
    expect(code).not.toContain('?.')
  })

  test('shares the disarm flag with the real reporter', () => {
    expect(app_html).toContain(DISARM_FLAG)
    expect(remote_log).toContain(`${DISARM_FLAG}?: boolean`)
    expect(remote_log).toContain(`.${DISARM_FLAG} = true`)
    expect(remote_log).toContain('disarm_boot_reporter()')
  })

  test('disarms only AFTER the real listeners are registered', () => {
    // Before them there would be an instant with nobody listening; inside a
    // handler the inline listener (registered first) would already have filed
    // a duplicate row for that same fault.
    expect(remote_log).toContain(`on_window('error'`)
    const first_real_listener = remote_log.indexOf(`on_window('error'`)
    expect(remote_log.slice(0, first_real_listener)).not.toContain('  disarm_boot_reporter()')
    expect(remote_log.slice(first_real_listener)).toContain('  disarm_boot_reporter()')
  })
})

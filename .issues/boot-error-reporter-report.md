# Outside-the-app boot-error reporter (LD) — completion report

**Date:** 2026-08-05 · **Plan:** `.issues/boot-error-reporter.md` · **Ported from:**
`~/code/tutor/.issues/boot-error-reporter-report.md`. Everything is UNCOMMITTED — Jacob commits.

## The gap this closes, in LD's own terms

`init_remote_logging()` installs the real `error` / `unhandledrejection` handlers from **inside**
`+layout.svelte`'s `onMount` — after the framework has started. A failure that stops the app from
starting therefore filed nothing at all. LD's 2026-08-04 review has the shape of the loss: a visitor
spent **92 minutes** on a dictionary that could never load, and the only reason we know is that her
app got far enough to log. A shell-level failure on the same bundle would have been perfectly
invisible.

## What shipped

**`site/src/app.html`** — inline `<script>` before `%sveltekit.head%` (next to the existing pre-paint
colour-scheme script), listening on **both** `error` and `unhandledrejection`, funnelling into one
`report(channel, message, filename, line, col)` closure behind a shared one-shot `fired` flag, and
beaconing a JSON `Blob` to **relative** `/api/log`.

**`site/src/lib/debug/remote-log.ts`** — `disarm_boot_reporter()` sets `window.__boot_reporter_off`
as the **last** statement of `init_remote_logging()`, after every real listener is registered.

**`site/src/lib/debug/boot-error-reporter.test.ts`** — the ported guard over the inline script's
source (both channels, relative `/api/log`, one `fired = true`, ES5-only, the shared flag name in
both files), plus two LD-specific cases: the `app_version` sniff and its kit-fixed-global exclusion,
and that the disarm appears only *after* the first real listener.

**`site/e2e/boot-error-reporter.mjs` + `pnpm test:boot`** — the acceptance test, kept as a runnable
script instead of deleted (tutor cleaned its artifacts). LD already has eight `e2e/*.mjs` scripts
with package scripts, and the inline reporter is exactly the kind of thing that needs re-verifying
after any `app.html` edit.

## Port-note checklist — verified against LD, not assumed

| Port note | Finding in LD |
|---|---|
| 1. Port the twin, not §5.1's letter | **Confirmed empirically here, not inherited.** Both outage shapes fired **only** as `unhandledrejection`. An error-only hook would file zero rows for either. |
| 2. Check your own CSP | **None.** No `kit.csp` in `svelte.config.js`; no `Content-Security-Policy` anywhere in the repo or in `vps-setup` (Caddy included). The pre-existing inline colour-scheme script is further proof. Inline is safe. |
| 3. Match YOUR endpoint's parsed fields | LD's `/api/log` accepts **both** `{ entries: [...] }` and a single top-level entry via `extract_single_entry`, which drops anything missing `level` **or** `message`. Used the single-entry form with `level: 'error'` + `message: 'boot_error'`, Blob typed `application/json` so `request.json()` parses it (same reason `send_log_beacon` does). |
| 4. Keep the beacon relative | Kept relative. LD has **no** absolute base-url helper — `post_request` already takes relative routes and `send_log_beacon` posts to `/api/log` — so tutor's specific hazard doesn't exist here, but a preview/staging origin still makes relative the only correct choice. |
| 5. Disarm placement + flag name + port the test | Flag set last in `init_remote_logging()`; same `__boot_reporter_off` name as tutor/house; guard test ported and extended. |
| 6. `build_target` only if a `PUBLIC_*` var exists | **Omitted** — LD is single-region and has no `PUBLIC_BUILD_TARGET` equivalent (`PUBLIC_MODE` is a test mock, `PUBLIC_BASE_URL` is a server-side const). The `url` column carries the host. |
| 7. Noise trade | Accepted as-is: no `is_ignored_error` filter, so a pre-init extension fault can file one row. `context.channel` + `filename` + `url` + `app_version` make it triage-able, and the one-shot caps it at one per load. |

## One addition beyond the tutor shape: `app_version`

Tutor sends `build_target`; LD has nothing to put there. But LD's `client_logs` has a real
`app_version` column, and LD's signature boot failure is a **stale bundle** — the 92-minute visitor
was on a 12-day-old build asking for a chunk a deploy had deleted. So the reporter sniffs the build
the visitor is actually running:

```js
Object.keys(window)  // → the page shell's `__sveltekit_<version_hash> = { … }` global
```

Readable even when the bundle that *reads* that global never loaded — which is precisely the failing
case. `sw` and `dev` are excluded because they are FIXED kit names (the service-worker env endpoint
and the dev payload), not build stamps — the same exclusion `scripts/check-build-version.mjs` makes,
and the exact trap that produced last night's cross-repo review item about tutor's build guard.

It works: case (b) below filed `app_version: "brokenxx"` — literally the broken name I injected into
the shell — so the row tells you **which stamp the shell wrote**, which is the whole diagnosis for a
shell/bundle version disagreement.

## Verification

| Check | Result |
|---|---|
| `npx vitest run` | **2638 passed**, 4 skipped, 353 files |
| `npx tsc --noEmit` | clean |
| `pnpm check` | **0 errors** (50 pre-existing warnings) |
| `npx eslint` (changed files) | clean |
| `pnpm build` | succeeds; `check-build-version.mjs` passes with the script in place (`__sveltekit_nrqdqc`), and `boot_error` is present in the built page template |
| `pnpm test:boot` | **exit 0**, all four cases below |

Acceptance, against a real `pnpm build` served by `node build` on a fresh `DATA_DIR`, rows read
straight out of that run's `logs.db`:

| Case | Rows | Row |
|---|---|---|
| **a.** `/_app/immutable/entry/*` blocked | **exactly 1** | `error \| boot_error \| app_version nrqdqc`, `{"channel":"unhandledrejection","boot_message":"Failed to fetch dynamically imported module: …/entry/start.Dq6J8qeQ.js"}` — names the missing chunk |
| **b.** shell's `__sveltekit_<hash>` broken | **exactly 1** | `app_version brokenxx`, `{"channel":"unhandledrejection","boot_message":"Cannot read properties of undefined (reading 'env')","filename":"at …/chunks/CZWmR7Mh2.js:1:375"}` — the Aug-3 blank-page shape |
| **c.** healthy load | **0** | `window.__boot_reporter_off === true` after load |
| **c2.** late error + late rejection after a healthy load | **0** `boot_error` | the real reporter files its own row instead |

Test artifacts removed (`/tmp/ld-boot-e2e-data`, `/tmp/ld-boot-shell`); all test servers stopped.

## Follow-ups (not done — deliberately out of scope)

- **A dashboard signal for `boot_error`.** NOT DONE and deliberately not started — beyond the
  approved scope, and tutor logged the identical follow-up, so this is a **cross-repo decision to
  take once**, not a per-app task. The case, for whoever picks it up: a `boot_error` row means
  somebody's app did not start, which is the most alarming row we can receive, yet it currently
  surfaces only via generic error clustering on `/admin/analytics`. A count on the health strip is
  the natural shape; note that Jacob removed LD's one cron-driven chat alarm on 2026-08-05, so lead
  with a panel, not a notification.
- **One-shot caveat** (inherited): a harmless pre-init rejection consumes the shot for that page
  load. If real traffic shows it, the fix is one row *per channel* (still 2 max), not removing the cap.
- **`app_version` is the hash, not the sha.** It is djb2 of the commit, matching what the client
  chunks carry; `check-build-version.mjs` prints both, and `/_app/version.json` maps hash → build. If
  triage wants the sha directly, that is a separate (server-side) change.

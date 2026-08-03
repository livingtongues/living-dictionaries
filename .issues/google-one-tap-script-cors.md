# Google One Tap SDK is blocked by its crossorigin load

> ✅ **FIXED (uncommitted) 2026-08-03** — tracked in `.issues/nightly-fixes-2026-08-03.md` item 1.
> `crossorigin="anonymous"` removed from `$lib/auth/load-script-once.ts` (now an opt-in `{ cors }`
> option, default off) and the duplicate `<svelte:head>` tag deleted from `AuthModal.svelte`, so
> there is ONE idempotent loader. Verified in a real headful Chrome: `gsi/client` returns 200, the
> Google iframe renders above the OR divider. `curl -sI -H 'Origin: …'` confirms Google sends NO
> `access-control-allow-origin` — the per-origin rule is now standing law in
> `.cron/log-reviews/decisions.md`. Delete this file once Jacob commits.

During headless production verification on 2026-08-01, every logged-out page emitted:

`Access to script at 'https://accounts.google.com/gsi/client' ... has been blocked by CORS policy`

The Ponca entry pages themselves rendered correctly with no page/runtime errors, but Google One Tap
did not load. `$lib/auth/load-script-once.ts` sets `script.crossOrigin = 'anonymous'` based on the
comment that GIS serves `Access-Control-Allow-Origin: *`; the current response did not include that
header. `AuthModal.svelte` also adds the same SDK independently through `<svelte:head>`, so the login
modal has two competing load paths.

This is outside the Ponca data repair and touches production authentication, so do not make a blind
one-line change. Reproduce in a normal browser, confirm Google's current supported loading pattern,
collapse to one idempotent SDK loader, and verify One Tap plus the modal button in logged-out/light/
dark states. Email OTP remains available.

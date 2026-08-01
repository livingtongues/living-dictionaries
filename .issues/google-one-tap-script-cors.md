# Google One Tap SDK is blocked by its crossorigin load

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

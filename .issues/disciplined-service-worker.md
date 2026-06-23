# Disciplined network-first service worker + version-poll (LD)

Cross-repo decision with `house` (2026-06-23). Jacob chose to **build a disciplined network-first
service worker for both apps** rather than kill LD's SW outright. The new LD SW doubles as the
**cutover kill**: shipping a fresh `/service-worker.js` makes the browser replace the **old Vercel
app's** zombie SW (it `delete_old_caches()` wipes the legacy `cache-*` / `offline*` caches +
`skipWaiting` + `claim`).

## Background (why this matters at cutover)
- The new VPS LD app **dropped** `src/service-worker.ts` (commit `2e3b145d`) → `/service-worker.js`
  404s → the old Vercel SW (network-first, version `1781028060855`) **lingers forever** in users'
  browsers (404 does NOT unregister a SW). Re-adding a real SW cleanly replaces it.
- The old deep-link **404 registration bug** (`.issues` note, pre-2.63) is GONE on **kit 2.63**:
  `prefixed('service-worker.js')` bakes a depth-correct `../../service-worker.js` that resolves to
  root `/service-worker.js` (scope `/`) on every route. Verified empirically on house
  (`/kjv/GEN/1` → `script_url = '../../service-worker.js'`). So **no `kit.paths.relative` change
  needed.**

## THE DISCIPLINE (codified in the SW file — don't regress)
- Navigations / data → **network-first** (fresh online; cache only as offline fallback). Never
  cache-first HTML, never stale-while-revalidate.
- Hashed build assets (`/_app/immutable/*`) → cache-first is SAFE (new deploy = new URL).
- Stable static files (icons, fonts, manifest) → precached for offline; may lag one reload on
  change (acceptable — not code). `dev-placeholder-*` excluded from precache.
- `/api/*` + cross-origin → **network-only**, never cached.
- activate → `delete_old_caches()` (also wipes the legacy Vercel caches) + `skipWaiting` + `claim`.

## Tasks — ✅ DONE (commit `ea207019`, pushed to `svelte-5-migration`)
- ✅ Added `site/src/service-worker.ts` (disciplined, ported from house, no bibles).
- ✅ `site/svelte.config.js`: `kit.version = { pollInterval: 60_000 }`.
- ✅ `site/src/routes/+layout.svelte`: `updated.current` → non-blocking "reload" toast (LD Toasts),
      never a forced reload.
- ✅ Verified: svelte-check 0 errors, eslint clean, 438 tests pass, prod build emits
      `build/client/service-worker.js` (15.8 KB) + `_app/version.json`.
- ✅ Registration resolves to root on deep routes (kit 2.63 parity with house). No e2e SW-filter
      needed (registration succeeds, no `pageerror`).
- ✅ Knowledge: `.knowledge/migration/service-worker-cutover.md` (+ index).

## Notes
- LD's `toast` API is byte-identical to house's (`toast(msg, { action, dismiss_label })`).
- LD SW intentionally OMITS house's navigation-preload optimization (avoids the `VITE_COMMAND`
  vite-define plumbing); freshness behavior is identical without it.

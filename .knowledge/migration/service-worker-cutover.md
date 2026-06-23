# Service worker — production cutover behavior

Decisions/gotchas around the LD service worker at the `livingdictionaries.app` Vercel→VPS cutover.
The discipline rules themselves are codified in `site/src/service-worker.ts`; this page captures
what you can't learn from the code.

## A new SW is the cutover "kill" for the old Vercel SW
The old Vercel app registered a network-first SW at `/service-worker.js` (version `1781028060855`).
It's installed in users' browsers **right now**. Key gotcha:

- **A 404 does NOT unregister a service worker.** The new app had dropped its SW (commit
  `2e3b145d`) → `/service-worker.js` 404s → the old SW would linger **forever** (still intercepting,
  holding stale `cache-*` / `offline*` caches, and serving the old shell to offline/flaky clients).
- The fix is **not** a 404 and **not** a separate self-destruct file — just **ship a real SW again**.
  The browser's next update check fetches `/service-worker.js`, sees new bytes, installs it, and its
  `activate` runs `delete_old_caches()` (deletes every non-current cache → wipes the legacy Vercel
  caches) + `skipWaiting` + `clients.claim`. The old zombie is cleanly evicted.

So `site/src/service-worker.ts` does double duty: it's the app's real SW **and** the cutover kill.
No forced client reload is issued (the SW is network-first, so live tabs already show fresh content;
forcing a reload could nuke an in-progress edit).

## The old deep-link 404 registration bug is gone on kit 2.63
LD once dropped the SW partly because registration 404'd on deep links (`/achi/…` →
`/achi/service-worker.js`). That was a **pre-2.63 quirk**. On kit 2.63 (current), SvelteKit bakes a
depth-correct relative `script_url` (e.g. `../../service-worker.js`) that resolves to root
`/service-worker.js` (scope `/`) on every route — verified live on house at `/kjv/GEN/1`. So
re-adding the SW needed **no** `kit.paths.relative` change, and the old `.issues/service-worker-404.md`
concern no longer applies. (If you ever see the 404 again, suspect a kit downgrade, not the app.)

## Why network-first + version-poll, not cache-first
Jacob iterates fast and is allergic to users being "one version behind." A network-first SW with
**cache-first only for content-hashed `/_app/immutable/*`** never serves stale *code* (new deploy =
new URL = cache miss = network). The one-version-back footgun is cache-first navigations / SWR /
caching data — all banned in the file. `kit.version.pollInterval` (60s) + the root-layout reload
toast covers idle pinned tabs (the SW only update-checks on navigation).

This is a shared decision with house — house already ran this SW shape; LD now matches it (minus
house's optional navigation-preload, which needs `VITE_COMMAND` vite-define plumbing).

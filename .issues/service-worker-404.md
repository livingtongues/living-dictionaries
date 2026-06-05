# Service-worker registration 404 on deep links (pre-existing) — ✅ RESOLVED (LD-MEDIA, 2026-06-05)

**Fix shipped:** Option 1 — dropped the service worker entirely (matches the example repo). Deleted
`src/service-worker.ts` + `src/routes/PromptReloadOnUpdate.svelte` (SW-only) + its `+layout.svelte` use;
removed the `ServiceWorker|service-worker.js` pageerror filter from `e2e/{achi-flow,dict-sync,
dict-watch-2ctx}.mjs`. All three e2es pass with `pageerror` empty — the 404 is gone. SvelteKit only
auto-registers the SW when `src/service-worker.*` exists, so deleting it stops registration; no
`kit.serviceWorker`/`paths` override needed.

---
## Original report (for context)


**Found by LD-P4B (2026-06-04) while verifying the P4b achi-flow.** Pre-existing; not caused by P4b.

## Symptom
On a production `node build`, loading any nested route (e.g. `/achi/entry/e_ja`) throws a
`pageerror`:

```
Failed to register a ServiceWorker for scope ('http://HOST/achi/') with script
('http://HOST/achi/service-worker.js'): A bad HTTP response code (404) was received…
```

The service worker (`src/service-worker.ts`) is built and served at the **root**
(`/service-worker.js`), but SvelteKit's auto-registration uses a **route-relative** URL
because `kit.paths.relative` defaults to `true` (no `kit.paths` override in `svelte.config.js`).
On `/achi/…` the relative `service-worker.js` resolves to `/achi/service-worker.js` → 404. So the
SW never actually registers on deep links (no PWA caching) and throws on every such load.

## Why it surfaced now
The achi-flow + dict-sync e2e assert `page.on('pageerror')` is empty. The SW registration is async
(on `load`); whether its 404 lands inside the assertion window is timing-dependent. P4a passed by
luck; P4b's watcher adds async work that shifts timing so the 404 reliably lands in-window.

**Interim:** both e2e harnesses now filter out the SW-registration error specifically (regex on
`ServiceWorker|service-worker.js`) so the gate reflects real app errors. Any other pageerror still
fails the test.

## Proper fix (decision for Jacob — medium, global)
Options, in rough order of preference:
1. **Drop the service worker** — the target/example repo (`living-dictionaries-example`) has **no**
   `src/service-worker.*` at all. Simplest; removes PWA caching (likely fine pre-launch).
2. **`kit.paths = { relative: false }`** in `svelte.config.js` — SW (and all assets) register at
   absolute `/service-worker.js` → 200. Correct for a root-served adapter-node app; blast radius is
   all asset/link URLs, so verify nothing depends on relative paths.
3. **`kit.serviceWorker = { register: false }`** + manual absolute-path registration where the PWA
   update prompt (`src/routes/PromptReloadOnUpdate.svelte`) expects it.

Once fixed, remove the `ServiceWorker|service-worker.js` filter from `e2e/achi-flow.mjs` +
`e2e/dict-sync.mjs`.

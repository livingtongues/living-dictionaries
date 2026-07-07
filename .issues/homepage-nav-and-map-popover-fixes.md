# Homepage: instant dict nav + map popover/label fixes

Three reported issues from the live homepage (`/`), all confirmed root-caused.

## 1. "Open Entry" waits for the whole dictionary to download ✅ (non-blocking boot)

**Root cause:** `[dictionaryId]/+layout.ts` does `const conn = await open_dict(...)`, and
`open_dict` (`dict-lifecycle.ts`) awaits `client.ready()` — which for a COLD boot doesn't resolve
until the multi-MB snapshot has downloaded + OPFS opened + migrated. SvelteKit holds the old page
visible until the layout load resolves → nav appears frozen.

**Everything downstream already supports instant nav:** the entry page `+page.ts` has a "cold
window" branch that server-fetches the single entry for immediate content; the entries list shows a
spinner while `loading`; `DictBootProgress` (root layout) streams the download %; all live stores
(`read_dict_bundle`, `DictLiveDb`, `DictSyncStatus`) queue their RPCs until the leader worker is
ready. The ONLY blocker is that one `await`.

**Changes:**
- [x] `dict-lifecycle.ts` `open_dict`: don't `await client.ready()`. Move `end_dict_boot_progress`
  + editor `set_role` re-assert into the `client.on_ready` callback. Return the connection shim
  synchronously (its queries queue in the transport until the leader is ready).
- [x] `[dictionaryId]/+layout.ts`: drop `if (!conn.is_opfs_backed) await initial_sync`; fire
  `conn.sync_now()` fire-and-forget always. (`is_opfs_backed` is null-until-ready anyway.)
- [x] `entries-ui-store.ts` `load_bundle_with_retry`: also retry on `code === 'timeout'` (cold-boot
  RPC timeout) with backoff, independent budget (6 attempts) so a boot slower than the 20s transport
  timeout doesn't leave the Orama list empty. Transport `DEFAULT_TIMEOUT_MS=20000`; timer starts when
  the request is buffered, so a >20s boot would otherwise time out the first bundle query.
- [x] Update stale "the load BLOCKS on open_dict" comments in `dict-boot-progress.svelte.ts` +
  `dict-instance.ts`.

**MemoryVFS trade-off (accepted):** pre-iOS-17 fallback clients boot empty (no OPFS snapshot) and
rely on pull-since-null; with non-blocking boot the entries LIST may flash empty briefly before the
sync fills in (instead of the old short block). Common OPFS path is clean (queries queue → full
snapshot data on ready, no empty flash). The entry page always paints server content via its cold
window regardless.

## 2. Mobile map popover truncated at the bottom ✅ (portal)

**Root cause:** the `above/below` flip uses a fixed `point.y > 150` threshold, and `.map` has
`overflow: hidden` (rounded frame). On a phone the map is only ~194px tall while the popover is
taller — it can't fit inside the map at all, so a lower-middle dot's downward popover gets clipped.

**Fix (`WorldMap.svelte`):** portal the popover to `<body>` with `position: fixed`; in `draw()`
compute viewport coords (`container.getBoundingClientRect()` + point), clamp X to the viewport,
flip above/below toward whichever side has room. Add a window `scroll` listener while a popover is
open so it stays glued for reduced-motion users (motion users get it via the pulse rAF loop).
Left tooltip (desktop hover) as-is — not reported, less prone (big desktop map).

## 3. Only the dot is clickable, not the label ✅

**Root cause:** `on_click` → `find_cluster` only hit-tests dot centers; the force-laid dict-name
labels are drawn on canvas but never registered as targets.

**Fix (`WorldMap.svelte`):** collect each single-dict label's screen box into `label_hit_boxes`
during `draw()`; add `find_label_dict(x, y)`; hit-test in `on_click` (open that dict's popover) and
`on_pointermove` (pointer cursor). Dict-name labels only (country/city labels aren't dictionaries).

## Extra: dict labels 1px larger ✅
`dict_font` 11px → 12px (fits LABEL_HEIGHT=13). Connector red label uses the same font → consistent.

## Verification ✅ (all passed)
Headless e2e `site/tools/e2e/verify-home-fixes.mjs` (uses the dev-only `__ld_worldmap.label_boxes()`
hook added to WorldMap for deterministic label-click testing):
- **Issue 1:** `/achi/entries` shell rendered in ~545ms; 485 entries then filled in; entry page renders.
- **Issue 2:** on a 390×780 mobile viewport, tapping the lowest-on-screen dict label opened a popover
  that is `fully_visible: true` + `not_clipped_by_map: true` (portaled out of `.map`). Screenshot
  `/tmp/home-map-mobile-popover.png` shows "Gta?" (a bottom-of-map dot) popover flipped up, fully shown.
- **Issue 3:** clicking the "Shauki" label opened its popover (`position: fixed`, portaled to body).
- **Font:** blue dict labels visibly larger (11→12px) in `/tmp/home-map-label-popover.png`.

Static checks: `pnpm test` → 1319 passed / 3 skipped; `pnpm check` (svelte-check) → 0 errors;
eslint on all touched files → 0 errors.

## Files touched
- `dict-client/dict-lifecycle.ts` — non-blocking `open_dict` (on_ready handles boot-bar + set_role)
- `routes/[dictionaryId]/+layout.ts` — drop `await initial_sync`; fire-and-forget `sync_now()`
- `search/entries-ui-store.ts` — cold-boot `timeout` retry budget in `load_bundle_with_retry`
- `dict-client/dict-instance.ts` + `dict-boot-progress.svelte.ts` — stale "load blocks" comments
- `home-v2/map/WorldMap.svelte` — portal popover (fixed + viewport clamp + flip), `label_hit_boxes`
  + `find_label_dict` (clickable labels), scroll re-glue, dict font 11→12px, dev `label_boxes()` hook
- `tools/e2e/local-create-entry.mjs` — stale comment; `tools/e2e/verify-home-fixes.mjs` — new regression script
- `.knowledge/migration/leader-worker-boot-robustness.md` — "Main-thread boot is non-blocking" note

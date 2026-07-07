# P1 — Homepage WorldMap `getBoundingClientRect` on null loops every animation frame

> ✅ **FIXED 2026-07-07.** Guarded `WorldMap.svelte:589` with `container?.getBoundingClientRect()`
> + early-return, and added `!container` to `draw()`'s top guard (line 363) so the pulse loop idles
> harmlessly. Verified: `pnpm check` 0 errors, remote-log tests pass, and svelte-look screenshots of
> `HeroUnit` confirm the map, connector lines, and the `selected_dict` popover still render (light +
> dark). Also hardened the logging layer so a future runaway loop can't flood telemetry
> (repeat-error coalescing in `remote-log.ts`). Shipping in the same commit.

**Filed:** 2026-07-07 (log review). **Severity:** 🔴 P1 — ~10,850 error rows in 24h (≈95% of the
day's errors, 40%+ of ALL log volume), on the **current** production builds. Live regression.

## Symptom
`Uncaught TypeError: Cannot read properties of null (reading 'getBoundingClientRect')` in
`nodes/4` (= `src/routes/+page.svelte`, the homepage). Fires **thousands of times per session**
(one session logged 6,236; an anonymous visitor logged 898 in ~90s). Affects anonymous visitors and
admins alike; the homepage is the site's front door.

## Root cause (verified in current source)
`src/lib/components/home-v2/map/WorldMap.svelte:589`

```ts
if (selected_dict && selected_dict.lng !== null) {
  const point = project_point({ lng: selected_dict.lng, lat: selected_dict.lat })
  if (point) {
    const rect = container.getBoundingClientRect()   // ← container can be null
```

`container` (`let container: HTMLDivElement = $state()`, bound at line 869
`<div class="map" bind:this={container}>`) is **unguarded** here — unlike the sibling
`map_frame?.getBoundingClientRect()` in `HeroUnit.svelte:95`, and unlike `draw()`'s own top guard
(line 363) which checks `context`/`base_projection`/`land_path`/`colors` but **not** `container`.

**Why it loops instead of throwing once:** the highlight **pulse** ripple
(`performance.now() % 1400`, ~line 553-578) calls `schedule_draw()` to keep animating *before*
execution reaches the popover block at 589. So the order inside `draw()` is: draw pulse →
`schedule_draw()` (next frame already queued) → **throw at 589**. The next frame is already
scheduled, fires, re-queues, throws again — an unbounded error storm for as long as a `selected_dict`
is set while `container` is null. `container` goes null vs `context` non-null during teardown /
hydration ordering (e.g. navigating away from the homepage while a dict is highlighted).

## Fix (recommended — NOT applied)
Guard the container read, mirroring the existing `map_frame?.` pattern:

```ts
    const rect = container?.getBoundingClientRect()
    if (!rect) return
```

or wrap the whole `if (selected_dict …)` popover block in `if (container && selected_dict …)`.
Belt-and-suspenders: add `|| !container` to the `draw()` top guard (line 363) so the whole draw
short-circuits when the container ref is gone — the pulse loop then idles harmlessly.

## Verification after fixing
- Reload homepage, hover/click a dict dot to set `selected_dict`, then SPA-navigate away mid-pulse —
  no console error.
- Re-run the log review: the `getBoundingClientRect` cluster should stop accruing on the new build
  (`errors_by_version` in `/admin/analytics` shows current-build volume drop to ~0).

## Context / not-already-fixed check
- Error's builds: `1783416104848` (2026-07-07T09:21 UTC, 8,190 hits) + `1783411458430` (2,664) —
  both **current** builds; `last_seen` 2026-07-07T11:32. Source at HEAD is still unguarded.
- The recent WorldMap commits (`89fb0d5d`, `7c561c0a`, `406c855c` …) added the popover/pulse/labels
  but never guarded `container` at 589. No later commit fixes it.

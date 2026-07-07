# /home-preview map round 3 (2026-07-07)

Jacob's batch, agreed decisions in parens.

## Status: ✅ all done — verified via vitest (1308 pass), pnpm check (0 err), eslint, and
headless puppeteer on live dev with the prod DB (India/Uttarakhand + Mexico/Guatemala at L2 & L3,
light/dark, mobile; strip filter; pills anon-history + logged-in). Round-2 committed as 7171d9eb.
NOT pushed. Awaiting Jacob's go to commit round 3.

## Tasks

1. ✅ **Prod data down** — backup local `site/.data/shared.db`, replace with prod copy
   (ssh living, docker cp pattern from database skill). Refresh `homepage-baked.json` via
   `node site/scripts/fetch-homepage-baked.mjs` (defaults to prod URL; 150+ approved cards).
   Mind the dev server holding shared.db open — stop/restart around the swap.
2. ✅ **No unlabeled dots at level 2/3** (WorldMap):
   - Track click depth (world=1 → country fit=2 → step=3). At depth 3 (or k high enough that
     dots separate / pinch fallback): **clustering off entirely, every dot labeled**. No level 4
     (grouped-cluster fall-through stays but nothing should be grouped at 3).
   - Force-layout label placement wherever dict labels draw (k ≥ 3.5): labels may sit any side
     of the dot; when displaced beyond snug, draw a small blue leader line label→dot.
   - Level 2: clustering stays, but every SINGLE dot must get a label. If a single's label
     truly can't be placed, merge that dot into a nearby cluster instead (re-bin locally).
   - Run the sim per settled view (debounced after zoom/pan), not per animation frame.
3. ✅ **Red connector label on canvas** — HeroUnit passes `{ dict_id, opacity }` of the active
   connector line into WorldMap; canvas draws that dict's label FIRST (wins collisions) in red
   with `· N entries` suffix, at its normal label position (or at the cluster/dot the line
   points to when the dict is inside a cluster, and at level 1 where no labels exist yet).
   Remove the floating SVG `<text>` label from HeroUnit. Suppress the blue copy (no duplicate).
4. ✅ **Strip strictly in-view when zoomed** (WordCards): drop the pad-to-MIN_CARDS behavior —
   in-view cards only; zero in view → full shuffled strip.
5. ✅ **Quick-jump pills under HeroSearch**:
   - New localStorage visited-dicts list (id/url/name, most-recent-first, cap 10), written from
     the `[dictionaryId]` layout on visit.
   - Logged-in users with dictionaries → own dicts; else visited dicts. Up to 3 pills +
     "+N more" pill expanding the rest inline. Replaces the current rough `my_dictionaries.slice(0,5)` row.
6. ✅ Verify: vitest, check, lint, puppeteer on live dev — Asia (N India) + Mexico/Guatemala at
   levels 2 & 3, light/dark, mobile; strip filter behavior; pills as anon-with-history and as
   logged-in user (dev-auth skill).

## Notes
- Mexico screenshot: many unlabeled singles at level 2 (Guatemala highlands) — the test case.
- Red label at line-end currently floats mid-container (`label_x` clamp) — that's what we're removing.
- Commit `7171d9eb` = round 2. Do NOT push (push deploys).

# Residual `effect_update_depth_exceeded` on entry pages (current build)

**Severity:** 🟠 P2 — recurring, multi-user, no known workaround. **Found:** 2026-07-06 log review.
**Status:** open, NOT yet root-caused (needs a runtime repro).

## Symptom

`Error: https://svelte.dev/e/effect_update_depth_exceeded` fires **13× across 4 distinct users on the
current build** (`1783303651101`, built 2026-07-06 02:07:31Z), last seen 15:18 UTC. Minified stack head
`Ne@…Ctv-SBfO.js:1:1987 / Or / br` (Svelte's flush/effect machinery — no app symbol survives).

## What's already been done (don't redo)

- 2026-07-04: entry star read moved `$derived` → `$effect` (cut the loop ~92%).
- 2026-07-06 `24b080b1`: the star `$effect` now depends on the **stable** `page.params.entryId` instead
  of the **live `entry` object** (`$derived($derived_entry ?? …)`, which re-emits a fresh object on every
  field edit + the initial live-row swap-in). This was the documented remaining cause — yet the loop
  persists on that very build, so there is **at least one more source.**

## Investigation notes (2026-07-06)

- The prime suspect explored — `RelatedEntries.svelte` reading `entry_relationships.query(…).rows`
  inside a `$derived` — was **ruled out**: `.query()` is memoized by an sql+params key (stable here,
  `entry_id` is a plain string prop), `construct_outside_reaction` makes reading the accessor inside a
  reaction safe, and the `$derived` only re-runs on a legitimate table notify. Converting it to the
  `$effect`+`$state` pattern was tried and **reverted** — it broke synchronous population (empty flash
  + broke the `WithRelationships` story) without evidence it was the loop source. **The rule is not
  "never read `.rows` in a `$derived`" — it's "never depend on an unstable live-object identity in a
  reaction that reads a tracking accessor."**
- So the next suspect is any entry-subtree reaction that (a) reads a live LiveDb accessor
  (`.rows`/`.objects`/`.id()`/`.query().rows`) AND (b) depends on the **live `entry` object** (unstable
  identity) rather than a stable id/param. Grep the entry tree (`EntryDisplay`, `EntryMedia`, `Sense`,
  `EntrySentence`, and any `$lib/components/entry/*`) for `$effect`/`$derived` closures that reference
  `entry.` (the derived object) while touching a live accessor.

## How to verify a fix (required before landing — no blind reactive edits)

1. **Repro:** open an entry that has senses + media + related entries on a client with the live dict.db
   open, then edit a scalar field (which re-emits the `entry` object) a few times / let initial sync
   stream rows in — watch for `effect_update_depth_exceeded` in the console (or the check-logs pipeline).
2. Apply the candidate fix (stabilize the dependency on an id/param, per the star-effect pattern).
3. Confirm the loop is gone in the repro AND the component still renders synchronously (svelte-look
   story screenshot for the touched component).
4. **Confirm in prod:** the next log review should show `effect_update_depth_exceeded` on the current
   build drop to ~0 (`build_errors_by_version` / the raw cluster query in the check-logs skill).

## Related

- P1 sibling crash on the same page: `.issues/entry-page-duplicate-key-crash.md` (the `each_key_duplicate`
  dedupe — already fixed at the `assemble_entry_data` choke point).
- `.issues/dict-table-accessor-rows-reactivity.md` (the construct-outside-reaction freeze rationale).

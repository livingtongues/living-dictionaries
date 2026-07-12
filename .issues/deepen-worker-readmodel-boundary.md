# Deepen the Orama worker read-model boundary — one `on_patch` event union instead of 10 positional proxies

**Recommendation strength: WORTH EXPLORING. Not yet assigned.**

Coordinate with: `.issues/deepen-entry-worker-join-engine.md` (same files — if both are done, do
THIS one first; it makes that diff much smaller) and the in-flight
`.issues/in-worker-orama.md` / texts-sentences corpus work (check state before starting).

## Problem

The comlink boundary between the entries UI store and the search worker crosses with **ten
positional proxied callbacks** — in a codebase whose own conventions ban positional multi-args
and bare booleans:

```ts
// lib/search/entry.worker.ts
export async function init_entries(
  options: { dictionary_id, can_edit, admin },
  bundle: EntriesDataBundle,
  set_entries_data, _upsert_entry_data, _delete_entry,
  _set_speakers, _set_tags, _set_dialects, _set_sources,
  set_loading, _mark_search_index_updated,
)
```

The interface is as wide as the implementation on BOTH sides:

- `lib/search/entries-ui-store.ts` defines 7 writable stores + 10 one-line setter functions whose
  only job is `store.set(x)` (plus `mark_search_index_updated`'s set-true-set-false pulse).
- `lib/search/index.ts` re-wraps each callback in `proxy(...)` positionally.
- `lib/search/entry.worker.ts` stashes each into a module-level variable
  (`upsert_entry_data = _upsert_entry_data` …) and calls them from `apply_rows` / `init_entries`.
- `InitEntryWorkerOptions` duplicates the signature a fourth time as an interface.

Adding one read-model slice (e.g. `texts` for the corpus pipeline) touches 4 files and a fragile
argument order. Each comlink `proxy()` is also a live MessagePort held by the worker — ten ports
where one would do.

## Design

One proxied callback carrying a discriminated union:

```ts
// lib/search/worker-patch.ts
export type WorkerPatch
  = | { type: 'entries_set', entries: Record<string, EntryData> }      // bulk init
    | { type: 'entries_upsert', entries: Record<string, EntryData> }   // incremental
    | { type: 'entry_delete', entry_id: string }
    | { type: 'speakers', rows: Tables<'speakers'>[] }
    | { type: 'tags', rows: Tables<'tags'>[] }
    | { type: 'dialects', rows: Tables<'dialects'>[] }
    | { type: 'sources', rows: Tables<'sources'>[] }
    | { type: 'loading', value: boolean }
    | { type: 'index_updated' }
```

- `init_entries({ dictionary_id, can_edit, admin, bundle, on_patch })` — one options object, one
  `proxy(on_patch)`. Worker stores ONE function ref.
- `entries-ui-store.ts` becomes a **reducer**: one `switch (patch.type)` that owns every state
  transition. The 10 setters and their plumbing disappear.
- `index.ts`'s `init_entries` wrapper shrinks to a passthrough (and can likely be inlined into
  the store — evaluate whether `lib/search/index.ts` still earns its keep afterward; its other
  exports `search_entries/search_sentences/search_texts/apply_rows` are one-line lazy-import
  passthroughs which are fine to keep for the dynamic-import behavior).

### Migration steps

1. Add `worker-patch.ts` with the union type.
2. Change `entry.worker.ts`: replace the 8 module-level callback vars with one `on_patch`;
   replace each call site (`set_entries_data(...)` → `on_patch({ type: 'entries_set', ... })`,
   etc.). `apply_rows` currently calls `upsert_entry_data`, `delete_entry`, `set_speakers` (when
   speaker rows change), `mark_search_index_updated` — map each.
3. Change `index.ts` `init_entries` to the options-object + single proxy form; delete
   `InitEntryWorkerOptions`'s ten callback fields.
4. Rewrite `entries-ui-store.ts` around `function apply_patch(patch: WorkerPatch)`; keep the
   exact store shape returned today (`subscribe`, `speakers`, `tags`, `dialects`, `sources`,
   `search_*`, `loading`, `search_index_updated`) — consumers (layout data keys, `View.svelte`,
   filters, print, etc.) must not change.
5. Preserve the `search_index_updated` pulse semantics (true→false flip) inside the reducer.

### Gotchas

- comlink `proxy()` callbacks return promises; today's worker code awaits none of them except
  implicitly — keep fire-and-forget semantics identical (don't start awaiting `on_patch` in the
  worker loop or a slow main thread will backpressure indexing).
- `set_entries_data` is called once with the full init map; `upsert_entry_data` merges — the
  reducer must keep that distinction (`entries_set` replaces, `entries_upsert` spreads).
- The worker holds proxies from a PREVIOUS navigation until the next `init_entries` replaces
  them — replacing ten refs with one shrinks the leak surface; make sure the old `on_patch`
  proxy is released (comlink `releaseProxy`) if straightforward.
- `orama.worker.ts` is NOT a separate Worker despite the name — it's a module imported inside
  `entry.worker.ts`. Don't touch it here (rename could be a tiny follow-up, but it churns
  imports; optional).

## Why (locality & leverage)

- The store↔worker contract becomes a single named type you can read in one screen; every state
  transition lives in one reducer instead of ten scattered setters.
- Adding a read-model slice = one union member + one reducer case (2 files, no ordering).
- Sets up the join-engine refactor (`.issues/deepen-entry-worker-join-engine.md`): when assembly
  moves out of the worker, the patch union is the stable seam that doesn't change.

## Tests

The reducer is pure(ish) and finally testable without a worker:

- `apply_patch` sequences: `entries_set` then `entries_upsert` (merge), `entry_delete` after
  upsert (gone), `loading` flips, `index_updated` pulse (subscribe and assert true-then-false).
- Ordering edge: `entries_upsert` for an id AFTER `entry_delete` for the same id (today's
  behavior: it reappears — assert whatever is intended and document it).
- Type-level: `WorkerPatch` exhaustiveness via a `never` default case in the reducer.

Existing `search-entries.test.ts` / `assemble-entry-data.test.ts` are untouched.

## Verification

- `pnpm test`, `tsc`, `pnpm lint`, `pnpm check`
- Manual dev: open a dict → list renders; edit a gloss → list/search reflect it (watcher →
  `apply_rows` → `entries_upsert` path); delete an entry → vanishes from list; speakers/tags/
  dialects/sources filters populate.
- svelte-look: entries list/table/gallery stories still render.

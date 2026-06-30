# Svelte 5 store consolidation: `createPersistedStore` (writable) → `PersistedState` rune class

Follow-on to the house/tutor/LD svelte-5 cleanup. Across the fleet we're consolidating the old
`writable`-based store factories onto rune classes so there's **one store idiom**. tutor is furthest
along (rune classes only; dead factories deleted). house just converted its `query-param-store`
factory → a `QueryParamState` rune class. **LD is the last holdout for `persisted-store`.**

> Written by the house-side agent; not started. Behavior-changing → verify in the browser before
> committing. This is taste/consistency work, not a correctness fix — the writable factory + `$store`
> auto-subscription is fully supported (not deprecated) in Svelte 5.

## Current LD state

LD already ships the **rune class** `PersistedState<T>` at
`site/src/lib/svelte-pieces/persisted-state.svelte.ts` (instance `value = $state`, `$effect` writes
to localStorage, `onDestroy` cleanup) — used in 2 spots already:
- `routes/api/me/dictionary-roles/+server.ts`
- `routes/admin/schema/graph/schema-graph.svelte`

But the **legacy writable factory** `createPersistedStore` still lives at
`site/src/lib/svelte-pieces/stores/persisted-store.js` (+ `.d.ts`), re-exported from
`svelte-pieces/index.ts` (line 22), with **3 real call sites**:

| Call site | Usage | Notes |
|---|---|---|
| `routes/+layout.ts` (line 43) | `createPersistedStore(columns_key, defaultColumns)` for `preferred_table_columns` | ⚠️ **`+layout.ts` is a load function — a NON-component context.** |
| `routes/[dictionaryId]/entries/EntriesPrint.svelte` (lines 42–48) | 7 stores: `preferredPrintFields`, `headwordSize`, `fontSize`, `imagePercent`, `columnCount`, `showLabels`, `showQrCode` | Read via `$store`, two-way bound, passed as props |
| `routes/[dictionaryId]/entries/print/PrintFieldCheckboxes.svelte` (lines 10–12) | receives 3 of them as props typed `ReturnType<typeof createPersistedStore<…>>` | prop types must change to `PersistedState<…>` |

## The catch: `+layout.ts` can't use `PersistedState`

`PersistedState`'s constructor calls `$effect(...)` + `onDestroy(...)`, which **require the component
initialisation phase**. A `+layout.ts` `load` is NOT a component, so instantiating `PersistedState`
there will not work (effects/onDestroy outside component init). Two options:

1. **Port `PersistedRootState`** from tutor/house
   (`site/src/lib/svelte-pieces/persisted-root-state.svelte.ts` — identical in both: uses
   `$effect.root` instead of `$effect`/`onDestroy`, so it works outside components). Use it for the
   `+layout.ts` case (and it's the natural home for any future module-scope persisted state). LD does
   **not** currently have this file. NOTE: re-verify `+layout.ts` actually needs a rune at all — if
   `preferred_table_columns` is only consumed by components, it may be cleaner to create it inside the
   root `+layout.svelte` as a `PersistedState` and pass via context, sidestepping the non-component
   problem entirely.
2. **Leave `+layout.ts` on the writable factory** and only migrate the two `.svelte` call sites — but
   then you can't delete `persisted-store.js`, so the consolidation is incomplete. Not recommended.

## Plan

- [ ] Decide the `+layout.ts` strategy (recommend: move `preferred_table_columns` creation into the
      root `+layout.svelte` as `PersistedState` + context, OR port `PersistedRootState`).
- [ ] `EntriesPrint.svelte`: `createPersistedStore<T>(key, init)` → `new PersistedState<T>(key, init)`;
      rewrite every `$store` read → `store.value`, and `bind:x={$store}` → `bind:x={store.value}`.
- [ ] `PrintFieldCheckboxes.svelte`: change prop types from
      `ReturnType<typeof createPersistedStore<T>>` → `PersistedState<T>`; update internal `$store` /
      `bind:` usages.
- [ ] Remove the `createPersistedStore` re-export from `svelte-pieces/index.ts` (line 22).
- [ ] Delete `stores/persisted-store.js` + `stores/persisted-store.d.ts`.
- [ ] Verify: `pnpm check`, `pnpm test`, `pnpm eslint` (LD's script names) all green.
- [ ] **Browser-verify** (behavior-changing): entries **print preview** (field checkboxes, headword/
      font size, image %, column count, labels, QR toggle all persist across reload) + the entries
      **table column** preference persisting across reload.

## Reference implementations (the exact shapes)

- house `QueryParamState` rune-class conversion (just done): the `$effect.root`-in-constructor
  pattern, synchronous-first-read for SSR-safe init, and the `bind:x={$store}` → `bind:x={state.value}`
  consumer rewrites. File: `house/site/src/lib/svelte-pieces/stores/query-param-state.svelte.ts`.
- tutor: `WritableState.svelte.ts` (lazy start/stop store-contract reimpl via `$effect.tracking()`),
  `persisted-state.svelte.ts`, `persisted-root-state.svelte.ts` — and tutor already **deleted** its
  dead `persisted-store.ts` / `query-params-store.ts` (0 importers).

## Gotcha (learned in house)

The **lazy getter pattern** in tutor's `WritableState` (creating an `$effect` inside the `value`
getter when `$effect.tracking()`) **throws if `.value` is read inside a `$derived`** (can't create an
effect in a derived). `PersistedState` avoids this — its `value` is a plain `$state` field, with the
`$effect` set up once in the constructor — so reading `.value` inside a `$derived` is safe. Keep that
property when touching these.

## Coordination note

When this issue was written, LD's `svelte-5-migration` branch had unrelated uncommitted WIP
(`api/v1/openapi.ts`, `routes/api/v1/+server.ts`) plus untracked api-docs/pdf-import files from
another session. Don't fold this store work into that tree — do it on a clean working tree.

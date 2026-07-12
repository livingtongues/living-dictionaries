# Svelte 5 store consolidation: `createPersistedStore` (writable) → `PersistedState` rune class

Follow-on to the house/tutor/LD svelte-5 cleanup. Across the fleet we're consolidating the old
`writable`-based store factories onto rune classes so there's **one store idiom**. tutor is furthest
along (rune classes only; dead factories deleted). house converted its `query-param-store` factory →
a `QueryParamState` rune class. **LD is the last holdout for `persisted-store`.**

> Behavior-changing → verify in the browser before committing. This is taste/consistency work, not
> a correctness fix — the writable factory + `$store` auto-subscription is fully supported (not
> deprecated) in Svelte 5.

## Current LD state (paths re-verified 2026-07-12 after the lib-layout migration)

LD already ships the **rune class** `PersistedState<T>` at
`site/src/lib/state/persisted-state.svelte.ts` (instance `value = $state`, `$effect` writes to
localStorage, `onDestroy` cleanup) — used in `routes/admin/schema/graph/schema-graph.svelte`.

The **legacy writable factory** `createPersistedStore` lives at
`site/src/lib/state/persisted-store.ts` with **3 call sites**:

| Call site | Usage | Notes |
|---|---|---|
| `routes/+layout.ts` | `createPersistedStore(columns_key, defaultColumns)` for `preferred_table_columns` (defaults in `$lib/stores/columns.ts` — the last file in the dissolving `stores/` folder) | ⚠️ **`+layout.ts` is a load function — a NON-component context.** |
| `routes/[dictionaryId]/entries/EntriesPrint.svelte` | 7 stores: `preferredPrintFields`, `headwordSize`, `fontSize`, `imagePercent`, `columnCount`, `showLabels`, `showQrCode` | Read via `$store`, two-way bound, passed as props |
| `routes/[dictionaryId]/entries/print/PrintFieldCheckboxes.svelte` | receives 3 of them as props typed `ReturnType<typeof createPersistedStore<…>>` | prop types must change to `PersistedState<…>` |

## The catch: `+layout.ts` can't use `PersistedState`

`PersistedState`'s constructor calls `$effect(...)` + `onDestroy(...)`, which **require the component
initialisation phase**. Two options:

1. **Port `PersistedRootState`** from tutor/house (uses `$effect.root` instead of
   `$effect`/`onDestroy`, so it works outside components) into `$lib/state/`. NOTE: re-verify
   `+layout.ts` actually needs a rune at all — if `preferred_table_columns` is only consumed by
   components, it may be cleaner to create it inside the root `+layout.svelte` as a
   `PersistedState` and pass via context, sidestepping the non-component problem entirely.
2. **Leave `+layout.ts` on the writable factory** and only migrate the two `.svelte` call sites —
   but then you can't delete `persisted-store.ts`, so the consolidation is incomplete. Not
   recommended.

## Plan

- [ ] Decide the `+layout.ts` strategy (recommend: move `preferred_table_columns` creation into the
      root `+layout.svelte` as `PersistedState` + context, OR port `PersistedRootState`).
- [ ] `EntriesPrint.svelte`: `createPersistedStore<T>(key, init)` → `new PersistedState<T>(key, init)`;
      rewrite every `$store` read → `store.value`, and `bind:x={$store}` → `bind:x={store.value}`.
- [ ] `PrintFieldCheckboxes.svelte`: prop types → `PersistedState<T>`; update `$store` / `bind:` usages.
- [ ] Delete `$lib/state/persisted-store.ts`; consider folding `$lib/stores/columns.ts` into a
      better home (e.g. beside the entries table) so the legacy `stores/` folder dissolves
      (lib-layout convergence).
- [ ] Verify: `pnpm check`, `pnpm test`, `pnpm lint` green.
- [ ] **Browser-verify** (behavior-changing): entries **print preview** (field checkboxes, headword/
      font size, image %, column count, labels, QR toggle all persist across reload) + the entries
      **table column** preference persisting across reload.

## Reference implementations (the exact shapes)

- house `QueryParamState` rune-class conversion: the `$effect.root`-in-constructor pattern,
  synchronous-first-read for SSR-safe init, and the `bind:x={$store}` → `bind:x={state.value}`
  consumer rewrites.
- tutor: `persisted-state.svelte.ts`, `persisted-root-state.svelte.ts` — and tutor already
  **deleted** its dead `persisted-store.ts` / `query-params-store.ts` (0 importers).

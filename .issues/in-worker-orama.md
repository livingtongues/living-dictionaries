# In-worker Orama + EntryData (move the entries read-model into the dict leader worker)

**Status: PLANNED — post-cutover.** Trigger to start: big dict (≥10k entries) × multi-tab editing
in real usage, OR memory/boot complaints, OR a free milestone slot before promoting the new app to
large-dict communities. Jacob has signed off on the UX-risk profile *provided* he double-checks
each converted view and the end state is the long-term-right flow (it is — see Target model).

## The problem (current per-tab pipeline)

Every tab independently builds the ENTIRE entries read layer:

1. `+layout.ts` → `create_entries_ui_store` → `read_dict_bundle(connection)`: 16 content tables ×
   `SELECT *`, RPC'd to the leader over the **BroadcastChannel** — whose responses fan to ALL tabs,
   so every open tab structured-clones every other tab's bundle traffic too.
2. The bundle goes over **comlink** into a per-tab **`entry.worker`** (a SECOND worker per tab,
   separate from the DB leader worker): `assemble-entry-data.ts` builds the denormalized
   **EntryData** read-model, `orama.worker.ts` builds the index (`multilingual-tokenizer`,
   `augment-entry-for-search`), and proxied callbacks push the full `entries_data` Record +
   speakers/tags/dialects back into main-thread stores.
3. `orama-watcher.ts` (one per tab, cached on `globalThis.__ld_orama_watchers`) delta-scans
   `updated_at` since a watermark (+ out-of-band hard-deletes via `subscribe_deletes`) →
   `apply_rows` → the tab's worker reassembles affected entries and reindexes.
4. Consumers of the full `entries_data` Record (held in EVERY tab's main thread):
   - entries **list/gallery/table** views — page through `search_entries` (comlink RPC to the
     per-tab worker; browse mode = empty term)
   - **entry detail** warm path — `$entries_data[entry_id]` (`entry/[entryId]/+page.ts`); cold
     path is server-side (`db/server/build-entry-data.ts`) and **unaffected by this plan**
   - **export** — `Object.values($entries_data)` (needs everything)
   - **print** — same class of consumer
   - speakers/tags/dialects side stores (fed via the same worker callbacks)

**Cost at 50k entries × N tabs:** N× full-bundle reads through the leader, N× assembly CPU,
N× EntryData Record on main threads, N× Orama index in per-tab workers, + channel-fan cloning of
all of it to every tab. Single-tab small-dict usage is fine today — this is a scale problem.

## Target model (house's `LibrarySearchIndex`, adapted)

ONE copy, owned by the dict leader worker, beside the DB it reads:

```
dict leader worker (dict-instance.ts)
  ├─ OPFS DB + sync engine            (existing)
  ├─ EntryData store (assembled once; delta-maintained)   ← moves in
  └─ Orama index (built once; delta-maintained)           ← moves in
tabs (any number)
  └─ RPC: search / get_entry_data / entry_data_chunks     ← page-sized payloads only
```

- **New `DbRequest`s** (mirror house's `search`/`multi_search` precedent):
  - `search` — `SearchEntriesOptions` in, hydrated EntryData page + total out (search code moves
    verbatim: `search-entries.ts`, tokenizer, augment, schema — parity risk is LOW for ranking).
  - `get_entry_data` — single EntryData for the entry-detail warm path.
  - `entry_data_chunks` — chunked full-dataset pull for export/print (e.g. 500/RPC; keeps any
    single broadcast-channel message small).
- **Delta maintenance moves in-process:** the instance already knows every change — `exec` /
  `dict_write` affected_tables, sync engine `on_tables_changed` / `on_rows_deleted`. The
  orama-watcher's debounced watermark scan is reused as-is, just running in the worker against its
  own connection (no RPC hop). Hard-deletes stop needing the out-of-band tab plumbing.
- **New broadcast:** `search_index_updated` (emitted post-reindex) — tabs re-run whatever query
  they have open. Replaces each tab's watcher + `mark_search_index_updated` callback.
- **speakers/tags/dialects stores** stop being worker callbacks — they're plain small tables;
  consume `dict_db.speakers.rows` etc. (live stores already exist).
- **Retired when done:** per-tab `entry.worker` + `expose-entry-worker` + `orama.worker` hosting,
  the comlink dependency (check for other users first), main-thread `read-dict-bundle` +
  `orama-watcher`, and the full `entries_data` Record store.

## Pros

- **Memory:** one EntryData + index copy total instead of per-tab. At 50k entries this is the
  difference between "second tab doubles everything" and "second tab costs a page of results".
- **Boot:** assembly + index build once per leader lifetime; every subsequent tab's first paint
  gets instant search against the warm leader (most common multi-tab case).
- **Channel traffic:** kills the full-bundle clone-to-all-tabs; payloads become page-sized.
- **Architecture convergence with house:** the worker harness is already byte-identical; this
  aligns the next layer up, so future fixes port 1:1 (house's `LibrarySearchIndex` is the proven
  template, including its refresh-on-sync wiring).
- **Simplification:** deletes one worker per tab, one IPC layer (comlink), and the trickiest
  cross-thread plumbing in the app (watcher → apply_rows → proxied callbacks).

## Cons / risks

- **Biggest dict-client refactor remaining.** It touches the product's core surface (entries
  list + search). Mitigated by phasing + parity harness below, and by the search internals moving
  verbatim rather than being rewritten.
- **Every full-Record consumer needs a new path:** entry detail warm path, export, print. Each is
  a regression surface; each gets its own checkpoint with Jacob.
- **Leader hand-off gap:** a newly-promoted leader must rebuild the index before search answers
  (DB reads still work instantly). Mitigations: eager rebuild on promote; optionally persist the
  serialized index gzipped in OPFS (tutor's pattern) for warm restart — defer unless the gap is
  felt.
- **Per-keystroke RPC latency:** search-as-you-type becomes an RPC per (debounced) keystroke over
  the BroadcastChannel. House proves this is fine; the existing debounce stays.
- **SSR/client assembler drift** (`db/server/build-entry-data.ts` vs `lib/search/assemble-entry-data.ts`)
  is unchanged by this plan but becomes more load-bearing — add/extend a parity test comparing both
  assemblers' output on the same fixture rows as part of Phase 1.
- **svelte-look mocks** (`mocks/layout.ts` etc.) mock `entries_data` — stories for entries views
  need their mocks reshaped to the paged API.

## What must ride along (the "smooth" checklist)

- [ ] Parity test: server assembler vs client assembler on shared fixtures (drift tripwire).
- [ ] Search-parity harness: scripted query set (incl. diacritics, typo-tolerance, onondaga
      elicitation sort, browse mode, filters) captured against the OLD path first, diffed against
      the new RPCs before any view switches.
- [ ] Baseline measurements on a big local dict (torwali 9,908 / nukuoro 6,613): tab boot time,
      per-tab heap, bundle bytes over the channel, multi-tab totals. Re-measure at the end.
- [ ] Entry-detail warm path → `get_entry_data` RPC (cold SSR path untouched).
- [ ] Export + print → `entry_data_chunks` (chunked; progress UI unchanged).
- [ ] speakers/tags/dialects → `dict_db` live stores.
- [ ] `search_index_updated` broadcast + tab-side re-run of the open query.
- [ ] MemoryVFS fallback sanity (index builds post-backfill; same code path).
- [ ] Leader hand-off: eager index rebuild on promote; verify via the smoke e2e's hand-off stage +
      a search-after-handoff assertion.
- [ ] Mocks/stories updates + svelte-look screenshots of every converted view (Jacob reviews).
- [ ] Retire legacy plumbing + update database SKILL.md, `m4-write-sync.md` /
      `opfs-leader-worker-dict-db.md` knowledge pages.

## Phasing (Jacob checkpoints marked 👁)

1. **Phase 0 — baselines.** Measurements + search-parity capture against the current path.
   No code changes shipped.
2. **Phase 1 — build alongside.** In-worker EntryData + index in `dict-instance.ts` behind the new
   RPCs, old path still live. Dev-only switch to exercise the new path; run the parity harness
   old-vs-new until the diff is empty. 👁 Jacob reviews the diff report.
3. **Phase 2 — convert consumers one at a time.** Order: entries list/gallery/table (search RPC) →
   entry detail warm path → export → print → side stores. Each lands separately with svelte-look
   screenshots + a manual pass. 👁 Jacob double-checks each view before the next.
4. **Phase 3 — delete the legacy layer.** entry.worker/comlink/read-dict-bundle/orama-watcher/full
   Record store; final re-measure vs Phase 0; docs + knowledge updates.
5. **(Optional, later) Phase 4 — persisted index.** Gzip the serialized index into OPFS beside the
   DB for instant warm leader boot (tutor pattern). Only if hand-off/boot rebuild is actually felt.

## Alternatives considered (and why not)

- **Targeted MessagePort for the bundle** (stop the clone-fan, keep per-tab model): fixes channel
  waste only; N× memory/CPU per tab remains. Not the long-term flow.
- **SQLite FTS5 in the dict DB:** different relevance + typo model; would discard the tuned
  multilingual tokenizer/augmentation. Search behavior parity matters more than engine purity.
- **Index in the leader TAB's main thread:** avoids the worker move but janks the leader tab and
  dies with it; the leader worker already has the right lifecycle.

# Deepen entry assembly — retire entry.worker's hand-rolled incremental join engine

**RETIRED AS A STANDALONE ISSUE 2026-07-12** (Jacob-approved, readmodel-boundary spike option C).
The durable idea — `gather_entry_slices`, SQL-shaped assembly shared with the server's
`build-entry-data.ts` — is FOLDED INTO `.issues/in-worker-orama.md` Phase 1, where assembly
lands in the dict leader worker next to its own connection (building it on the main thread
first would construct it in the wrong place only to move it). The mirror-drift analysis below
remains the reference for why the hand-rolled join engine must die; in-worker-orama deletes it
wholesale. Do NOT execute this issue standalone.

---

Original analysis (kept for reference):

Do AFTER `.issues/deepen-worker-readmodel-boundary.md` (the patch-union seam makes this diff much
smaller). Also coordinate with the texts/sentences corpus pipeline
(`.issues/texts-sentences-pipeline.md`) — `collect_corpus_effects` in the worker is part of that
feature and must keep working.

## Problem

`site/src/lib/search/entry.worker.ts` (776 lines) maintains an **in-memory relational mirror** of
all 20 dict tables: module-level `key_by_id` maps + pair-keyed junction maps, **14 hand-written
`recompute_*` join-maintenance functions**, and a **215-line `apply_one` switch** that re-derives
"which entries are affected" per table. This re-implements, by hand and in a second paradigm,
joins that:

- SQLite already knows (the schema + FKs), and
- the server twin already does in plain SQL — `site/src/lib/db/server/build-entry-data.ts`
  gathers one entry's subgraph with 6 straightforward JOIN queries and feeds the shared
  `assemble_entry_data`.

So "how does a photo reach an entry" is encoded twice: once as SQL
(`sense_photos JOIN senses`), once as grouping-map bookkeeping
(`recompute_sense_photos` + `pair_values` + `apply_one`'s `sense_photos` case).

**The seam leaks.** Duplicate-junction bugs escaped the mirror to the UI, forcing defensive
patches at TWO downstream layers: `dedupe_by_id` inside `assemble_entry_data` (see
`.issues/entry-page-duplicate-key-crash.md`) and `dedupe_keyed_children` guards in
`Sense.svelte`. Mirror-drift bugs are structurally possible because the mirror is maintained by
hand.

## Direction

Make the incremental path **query-shaped like the server path**, so assembly has ONE
implementation:

1. Extract `build_entry_data`'s row-gathering into a shared, connection-parameterized builder:
   `gather_entry_slices({ query, entry_id })` where `query: (sql, params) => Promise<rows>` —
   better-sqlite3 wraps sync→async trivially server-side; the browser side already has this
   exact interface three times over (`DictWriteConnection`, `EngineConnection`,
   `QueryableConnection` in orama-watcher/read-dict-bundle — reuse one).
2. The orama-watcher already scans wa-sqlite for changed rows since a watermark. Change its
   output from "raw rows per table" to **affected entry ids** (+ corpus effects for
   sentences/texts). Affected-id derivation from a changed row is a small lookup table
   (`sense_photos` row → `senses.entry_id` via one query; `senses` row → its `entry_id`; etc.) —
   this is the ONE piece of reverse-join knowledge that must remain, and it becomes ~20 lines of
   SQL-backed mapping instead of 400 lines of mirror maintenance.
3. For each affected entry id, run `gather_entry_slices` + `assemble_entry_data` **on the
   watcher side** (main thread or — better long-term — inside the leader worker, see
   `.issues/in-worker-orama.md` which may already be moving Orama into the leader worker;
   RECONCILE WITH THAT ISSUE FIRST, it changes where this lands), then hand finished
   `EntryData` docs to the search worker via the patch union
   (`entries_upsert` / `entry_delete`).
4. The search worker keeps ONLY: Orama indexes + `augment_*_for_search` + search functions + a
   doc store for corpus docs. All grouping maps, `recompute_*`, `apply_one`, `pair_values`,
   `key_by_id`/`key_by_pair`, `find_row_by_id`, `process_entry`/`process_and_update_entry`
   delete.
5. Bulk init: keep a fast path. Either (a) keep one single-pass grouping assembler ONLY for the
   initial bundle (still shared-shape via `assemble_entry_data`, as today), or (b) batch SQL:
   gather all slices with per-table full scans + group in one pass — which is exactly what the
   current init does, so (a) is pragmatic: init keeps the existing bulk grouping, ONLY the
   incremental mirror goes away. The incremental path is where the complexity and the drift
   bugs live.

## Costs / open questions (the spike)

- **Where does assembly run?** Main thread per-change assembly is small (only affected entries)
  but adds main-thread SQL round-trips; inside the leader worker it's free of RPC but only the
  leader has the connection — followers get docs via broadcast. The in-worker-orama issue likely
  decides this. Answer that first.
- **Burst behavior:** a big sync pull touching 5k rows → affected-entry set could be thousands;
  per-entry gather = N×6 queries. Mitigate: batch with `WHERE entry_id IN (...)` chunks, or fall
  back to full re-init above a threshold (simple, predictable).
- **Corpus docs:** `collect_corpus_effects` (sentences/texts) needs the same treatment —
  affected sentence/text ids → re-gather → `augment_sentence/text_for_search`. Keep parity with
  whatever the corpus pipeline has landed.
- **Speakers/tags/dialects/sources lists:** today `apply_rows` refreshes these store slices from
  the mirror; after, refresh via one `SELECT *` per changed table (they're tiny tables).

## Why (locality & leverage)

- Relational knowledge lives ONCE, in SQL, next to the schema. SSR and client read-models become
  identical **by construction**, not by parallel maintenance.
- The dedupe band-aids can eventually be demoted to assertions (keep `dedupe_by_id` but log if
  it ever fires — it shouldn't once the mirror is gone).
- ~400 lines of the highest-drift-risk code deleted; `entry.worker.ts` becomes a pure
  index/search module — the thing its name claims.

## Tests

- `gather_entry_slices` tested against in-memory better-sqlite3 (extend
  `build-entry-data.test.ts` — same fixtures now cover browser + server assembly).
- Affected-id mapping: table-driven test — for each watched table, a changed row maps to the
  right entry ids (including junction rows whose parent sense/entry was itself just created in
  the same batch).
- Threshold fallback: >N affected entries triggers full re-init (assert the decision function,
  pure).
- Existing `assemble-entry-data.test.ts` + `search-entries.test.ts` unchanged — they're the
  regression net.

## Verification

- Manual dev: edit gloss → search finds new text; add photo → gallery updates; delete sentence →
  corpus search drops it; big pull (open a stale dict) → list correct and no jank.
- Compare SSR entry page HTML vs hydrated client entry for a media-rich entry (should be
  byte-identical as today).
- Perf sanity: time `apply_rows` before/after on a large dict (e.g. seed from a prod snapshot)
  for a single-entry edit and a 100-row pull.

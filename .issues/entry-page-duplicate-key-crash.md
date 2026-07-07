# Entry page crashes with `each_key_duplicate` on duplicate child rows

**Severity:** 🔴 P1 — blanks the entire entry page. **Found:** 2026-07-06 log review
(`.cron/log-reviews/2026-07-06.md` §1). **Status:** ✅ **Phase-B guard-log + live/flattened-path
dedupe LANDED 2026-07-07 (uncommitted).** See "Run-3 completion" below.

## ✅ Run-3 completion (2026-07-07) — guard-log + uncovered-path dedupe shipped

Completes the two-part fix the run-2 update called for. **Uncommitted — Jacob reviews/commits.**

**New helper:** `$lib/utils/dedupe-keyed-children.ts` — `dedupe_keyed_children({ rows, child_kind,
entry_id, dict_id })`. Dedupes an id-keyed array (via the existing `dedupe_by_id`) AND, when a
duplicate id is present, ships **`entry_render_duplicate_key`** (`warn`, `{ entry_id, child_kind,
dup_id, dict_id }`) via `log_warning` so the offending list names itself in telemetry instead of
throwing a minified `each_key_duplicate`. Browser-only (SSR data is clean → the corruption is
client-local). Inline-tested.

**Wired into every entry-page keyed `{#each … (row.id)}` render point** (`child_kind`):
- `RelatedEntries.svelte` → `related_entries` — **the leading suspect: a live
  `dict_db.entry_relationships.query` that BYPASSES `assemble_entry_data`.** Now deduped in its
  `$derived.by`.
- `EntryMedia.svelte` → `photos` / `videos` — **the other genuinely-uncovered gap: these are
  FLATTENED across senses** (`entry.senses.map(s => s.photos).flat()`), so the same medium linked to
  two senses dupes even though `assemble_entry_data` dedupes per-sense. Now deduped at the flatten.
  Also `audios` (already deduped upstream — guard-log only).
- `EntryDisplay.svelte` → `senses`, `Sense.svelte` → `sentences` — already deduped at the
  `assemble_entry_data` choke point; the guard-log names them if a dupe ever slips through.

**Audit of the other entry-page keyed `{#each}` blocks (all cleared):** `orthographies.alternates`
(`orthography.code`) + `EntrySentence`'s `orthographies.all` are config-derived, not id-junctions;
`glossingLanguages` (`bcp`) is `Set`-deduped in `order_entry_and_dictionary_gloss_languages`;
`EntrySemanticDomains` / `EntrySource` / `BadgeArray` key on value/index, not a live-query id. The
child components (`EntryDialect`, `EntryTag`, …) render from the already-deduped read-model arrays,
not live queries. So `RelatedEntries` (live) + `EntryMedia` photos/videos (flatten) were the only two
uncovered id-keyed paths; the rest get the guard-log as belt-and-suspenders.

Verified: `pnpm check` (0 errors), `pnpm eslint`, and `pnpm vitest run` (347 passing incl. the new
inline tests). The next `each_key_duplicate` occurrence will now emit `entry_render_duplicate_key`
naming the exact list — if it's still hit, query that event to confirm whether the culprit is
`related_entries` (as hypothesised) or another list.

---

## ⚠️ Run-2 update (2026-07-06 21:00 UTC) — fix incomplete, real cause is `RelatedEntries`

The first fix `4b63fd30` (deployed in build `1783356060114`, built 16:41 UTC) added `dedupe_by_id`
at the shared `assemble_entry_data` choke point. **The crash still fires on that exact build** — 17
hits, last 20:37 UTC (well after deploy), a *different* Sugt'stun entry
(`/sugtstun/entry/60e04a4d-142c-46e8-b551-6e6ea67e697c`, "cungag / be blue"), and its breadcrumbs
end at a related/variant word ("cungagluni **or** (cungagqaq)").

**Why the fix missed it:** `assemble_entry_data` only builds the entry object used by SSR + the Orama
worker read-model (senses / media / tags / dialects / per-sense sentences — all now deduped). But the
entry page also renders id-keyed `{#each}` blocks from **SEPARATE live reactive `dict_db` queries**
that never touch `assemble_entry_data`. The leading suspect is **`RelatedEntries.svelte`**:

- `RelatedEntries.svelte:38` — `dict_db.entry_relationships.query({ where: 'from_entry_id = ? OR to_entry_id = ?', … })`
- `:46` — `items = $derived.by(...)` pushes `{ id: row.id, … }` per row
- `:90` — `{#each items as item (item.id)}` → **keyed on `row.id`**

A **duplicate `entry_relationships` junction row** → two `items` with the same `id` →
`each_key_duplicate`. This live-query path was NOT covered by the assemble dedupe.

**⚠️ Caveat — not yet proven which list throws.** On the server the Sugt'stun `entry_relationships`
table has **zero** rows for the crashing entry `60e04a4d` and **no duplicate ids anywhere**. So any
dupe is **purely client-local** (unhealed pre-`24b080b1` corruption the server never had), which means
we cannot confirm from the server whether `RelatedEntries` (or some other live-keyed `{#each}`) is the
one throwing. The minified stack (`ke@…Ctv-SBfO.js`) doesn't name the list either.

**Recommended completion (two parts, do both):**

1. **Ship the Phase-B guard-log FIRST — it's now essential, not optional.** Wrap the entry-page keyed
   arrays so a duplicate id emits `entry_render_duplicate_key` (`warn`, `{ entry_id, child_kind,
   dup_id, dict_id }`) *instead of* throwing. The very next occurrence then names the exact list +
   dup id in one query, ending the guessing. Without it every future run re-guesses.
2. **Dedupe the live-query paths too.** `dedupe_by_id` the `rows`/`items` in `RelatedEntries.svelte`'s
   `$derived.by`, and audit every OTHER entry-page live `dict_db.*.query(...)` feeding an id-keyed
   `{#each}` for the same gap. Same one-line fix shape, applied at each live call site the read-model
   doesn't cover.

## Symptom

Repeated `Error: https://svelte.dev/e/each_key_duplicate` (136 hits, 1 user, 10–12 reloads of the
*same* entry) followed by a cascade of `undefined is not an object (evaluating 'n().page')` /
`M(n).query=e` / `M(o).view=e` / `can't access property "query"` — all the entries-UI store
unwinding after the keyed-each throws.

- URL: `/sugtstun/entry/998c2a74-41a2-42c5-9607-27f82cc77060?q={"query":"anno","tags":["teglunaliq"]}`
- app_version `1783303651101` = **built 2026-07-06 02:07:31Z** — i.e. AFTER both entry-page fixes
  (`daed5d93`, `24b080b1`), so it is genuinely open, not a stale-tab artifact.

## Root-cause hypothesis

Svelte's keyed `{#each … (id)}` throws `each_key_duplicate` when two rendered siblings share a key.
The entry page keys children by id:

- `EntryDisplay.svelte:92` — `{#each entry.senses || [] as sense, index (sense.id)}`
- `EntryMedia.svelte:45/52/91` — audios `(sound_file.id)` / photos `(photo.id)` / videos `(video.id)`
- `Sense.svelte:99` — `{#each sense.sentences as sentence (sentence.id)}`

A **duplicate junction row** in this user's *local* dict DB → two children with the same id → the
keyed each throws → whole page blanks. This matches `24b080b1` ("harden dict junction sync ordering"),
which stops *new* dupes but **does not heal already-corrupted local DBs** — a pre-existing dupe still
detonates on render.

## Recommended fix (NOT yet applied)

1. **Defensively de-dupe entry children by id** where the reactive rows are derived (senses, audios,
   photos, videos, sentences) — belt-and-suspenders against corrupted local data. A one-pass
   `dedupe_by(rows, r => r.id)` on the derived arrays.
2. And/or make the keyed `{#each}` resilient so one bad row can't blank the whole page.
3. Add a Phase-B guard-log at the same time — `entry_render_duplicate_key` (`warn`,
   `{ entry_id, child_kind, dup_id, dict_id }`) — so the *next* occurrence names the list + dup id
   instead of a minified stack. Consider a `local_dict_duplicate_junction` integrity probe on dict open.

## Verify

- Reproduce by seeding a duplicate junction row (e.g. two `senses_in_entries` / media-link rows with
  the same child id) in a local dict DB, open the entry, confirm the crash, then confirm the dedupe
  guard renders the entry with one copy.
- Confirm the related P2 (`effect_update_depth_exceeded`, 13×/4 users on the same current build — the
  02:07 fix was incomplete) is tracked separately; it may share the entries-UI store path.

# Entry page crashes with `each_key_duplicate` on duplicate child rows

**Severity:** 🔴 P1 — blanks the entire entry page. **Found:** 2026-07-06 log review
(`.cron/log-reviews/2026-07-06.md` §1). **Status:** open on the current build.

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

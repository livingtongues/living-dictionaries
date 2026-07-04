# Dictionary-home follow-ups: v1 API parity + prod backfill + derived-bug fix & POC

Continuation of `.issues/dictionary-home.md` (Jacob approved all three, 2026-07-04):

## 1. v1 API parity for featured entries (star/unstar/reorder) ✅ plan

Mirror the human star toggle through `/api/v1` (parity direction in AGENTS.md).

- New server module `site/src/lib/db/server/v1-featured-entries.ts` (v1-texts style):
  - `list_featured_entries(db)` → reuse `get_featured_cards` from `dict-home.ts` (rich card shape)
  - `star_entry({ db, history_db, entry_id, user_id, api_key_id })` — validate entry exists (404),
    idempotent if already starred (`created: false`), sort_key = `key_between(last, null)`,
    write via `merge_dict_row` (history rides along)
  - `unstar_entry({ ... entry_id ... })` — resolve featured row by entry_id, `run_tombstone_delete`
  - `reorder_featured({ order: entry_id[] })` — full-order reassign via `initial_keys`
    (mirrors v1-texts `sentence_order`)
- Routes:
  - `GET/POST/PATCH /api/v1/dictionaries/[id]/featured-entries` (+server.ts)
  - `DELETE /api/v1/dictionaries/[id]/featured-entries/[entryId]`
- `server.test.ts` modeled on texts/server.test.ts (in-memory dbs, real API keys)
- openapi: add paths in `$lib/api/v1/openapi.ts`
- `mirror_dictionary_cursor` + `log_server_event` after writes (tags pattern)

## 2. Prod backfill of the 26 pre-pivot approved cards

Per curate-featured-words.md "Backfill" section: `approved` (actually all pre-pivot) rows have
NULL modal fields (`phonetic`, `glosses`, `speaker_name`, `example_sentence`). Re-harvest by
`(dict_id, entry_id)` from `/data/dictionaries/<id>.db` on the living VPS and UPDATE shared.db
rows in place. stdin-node script via `ssh living 'docker exec -i sveltekit_blue node'`.
ONLY the backfill — no new curation batch this pass.

## 3. Derived-reactivity bug: root-cause, POC, fix

Bug: `.issues/dict-table-accessor-rows-reactivity.md` — bare
`$derived(dict_db.<table>.rows.find(...))` silently never updates when the store is
lazily CREATED inside that derived's first evaluation.

### Root-cause findings so far (svelte 5.56.2 source)
- `$state()` created while a reaction is running is recorded in `current_sources`
  (`push_reaction_value`, runtime.js:99).
- `get()` SKIPS dependency registration for signals in `current_sources`
  (runtime.js:540) — loop guard. So the derived that constructs the store gets NO
  dep on the store's `#rows`/`#loading` field signals.
- BUT the `#rows` array's deeply-reactive proxy uses plain `source()` internally
  (length + indices, proxy.js) which is NOT in `current_sources` → naive theory says the
  length dep should still fire. Something else also breaks — needs the POC to pin down
  (candidates: `with_parent`/`update_version` source-parenting in proxy.js, effect-inside-
  derived lifecycle `destroy_derived_effects`).
- The working two-derived query-accessor pattern works because the store is created in
  derived #1 (`.query()`) while `.rows` is read in derived #2.

### Plan
- POC app in repo root `reactivity-poc/` (own lockfile like `scripts/`, NOT a workspace member):
  minimal SvelteKit app, a mimic store (`$state` rows + lazy creation on first `.rows` read +
  async populate), two routes:
  - `/broken` — the current pattern (store created inside the consuming `$derived`)
  - `/fixed` — same consumer code but store creation hoisted out of the reaction (the fix)
  Buttons to add rows + visible live output so Jacob can confirm each behavior in seconds.
- Fix in `site`: ensure store creation happens OUTSIDE the consuming reaction in
  `dict-live-db.svelte.ts` (`#get_table_store` / `#get_row_store` / `#create_query_accessor`)
  and the admin `live-db.svelte.ts` equivalents. Candidate mechanism: construct inside a
  short-lived `$effect.root` (active_reaction === null there → state not pushed to
  current_sources), destroyed immediately.
- Verify: POC first (reproduce + validate mechanism), then the real store (browser e2e on the
  entry-page star with the bare-rows pattern restored? — at least a targeted check), tests,
  update the database skill docs + close out the TODOs in the reactivity issue file.
- house has the same store code — NOT in this repo's scope; note for a follow-up session.

## Progress

- ✅ v1 featured-entries module + routes + tests (10) + openapi (+ manifest test updated)
- ⏸ prod backfill STAGED, blocked on deploy: prod shared.db has 34 `suggested` rows (0 approved —
  the "26 approved" are local dev `seed-*` rows, zero id overlap with prod) and NO pivot columns
  yet (pivot migration `20260704a` is uncommitted). Script `/tmp/fe-backfill.js` (copy below):
  re-harvests modal fields per row from `/data/dictionaries/<id>.db` + UPDATEs in place;
  `--write` to apply, dry-run default, aborts if the pivot migration is absent (guard tested on
  prod). Harvest logic verified read-only against prod: 34/34 glosses + speaker, 14 phonetic,
  6 example sentences, 0 missing entries. RUN AFTER the next deploy:
  `ssh living 'docker exec -i sveltekit_blue node' < /tmp/fe-backfill.js` (then `--write`).
- ✅ POC reproduces the bug (`reactivity-poc/`: `/broken`, `/broken-find` = exact entry-page
  replica frozen even for untracked pulls, `/fixed` live — verified headless on stock svelte)
- ✅ root cause pinned precisely (svelte `current_sources` dep-exclusion covers class `$state`
  AND deep-proxy internals — `proxy.js` aliases `state as source` — AND nested deriveds;
  the creator reaction ends its run with zero deps → frozen forever; confirmed by
  instrumenting runtime.js `get()`/dep-wiring with `[dep-skip]`/`[wired]` taps)
- ✅ fix shipped: `$lib/db/client/live/construct-outside-reaction.svelte.ts` wrapping all 3
  store-creation sites in BOTH dict-live-db + admin live-db; both `id()` accessors simplified
  (their nested `$derived` had the same freeze); entry page restored to the bare
  `.rows.find(...)` pattern and verified live in a real-browser e2e (star toggled 4×)
- ✅ database skill KNOWN BUG → fixed guidance; reactivity issue file closed out with root
  cause; knowledge entry `.knowledge/svelte/lazily-created-state-in-deriveds.md`
- ✅ site verification: 1245 vitest passed, check 0 errors, lint clean (POC excluded from
  root eslint as a sandbox)
- [ ] FOLLOW-UP (separate repo): port the fix to house's `LiveDb` (same store code)

### Staged backfill script (copy of /tmp/fe-backfill.js)

```js
// Backfill pre-pivot featured_entries rows (NULL glosses) with the modal
// snapshot columns, re-harvested from each source dict DB. Idempotent.
// DRY RUN unless argv includes --write. Run AFTER the pivot migration deploys.
const Database = require('better-sqlite3')
const write = process.argv.includes('--write')
const shared = new Database('/data/shared.db', { readonly: !write })

const clean = (value) => {
  if (typeof value !== 'string') return value
  const stripped = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return stripped || null
}
const clean_multistring = (json) => {
  if (!json) return null
  let map
  try { map = JSON.parse(json) } catch { return null }
  const out = {}
  for (const [locale, value] of Object.entries(map)) {
    const cleaned = clean(value)
    if (cleaned) out[locale] = cleaned
  }
  return Object.keys(out).length ? JSON.stringify(out) : null
}

const has_pivot = shared.prepare(`SELECT COUNT(*) AS n FROM pragma_table_info('featured_entries') WHERE name = 'glosses'`).get().n === 1
if (!has_pivot) {
  console.error('ABORT: pivot migration not applied (no glosses column)')
  process.exit(1)
}
const targets = shared.prepare(`SELECT id, dict_id, entry_id, sense_id, audio_id FROM featured_entries WHERE glosses IS NULL`).all()
console.error(`${targets.length} rows need backfill`)
const update = write
  ? shared.prepare(`UPDATE featured_entries SET phonetic = ?, glosses = ?, speaker_name = ?, example_sentence = ? WHERE id = ?`)
  : null
let updated = 0
const report = []
for (const t of targets) {
  const db = new Database(`/data/dictionaries/${t.dict_id}.db`, { readonly: true, fileMustExist: true })
  try {
    const entry = db.prepare(`SELECT phonetic FROM entries WHERE id = ?`).get(t.entry_id)
    if (!entry) { report.push({ id: t.id, dict_id: t.dict_id, skipped: 'entry gone' }); continue }
    const sense = db.prepare(`SELECT glosses FROM senses WHERE id = ?`).get(t.sense_id)
    const speaker = db.prepare(`SELECT sp.name FROM audio_speakers aspk JOIN speakers sp ON sp.id = aspk.speaker_id WHERE aspk.audio_id = ? LIMIT 1`).get(t.audio_id)
    const sentence = db.prepare(`SELECT json_object('text', json(st.text), 'translation', json(st.translation)) AS es
      FROM senses_in_sentences sis JOIN sentences st ON st.id = sis.sentence_id
      WHERE sis.sense_id = ? AND st.text IS NOT NULL LIMIT 1`).get(t.sense_id)
    const values = {
      phonetic: clean(entry.phonetic ?? null),
      glosses: clean_multistring(sense ? sense.glosses : null),
      speaker_name: speaker ? clean(speaker.name) : null,
      example_sentence: sentence ? sentence.es : null,
    }
    report.push({ id: t.id, dict_id: t.dict_id, ...values })
    if (write) { update.run(values.phonetic, values.glosses, values.speaker_name, values.example_sentence, t.id); updated++ }
  } finally {
    db.close()
  }
}
console.log(JSON.stringify(report, null, 1))
console.error(write ? `UPDATED ${updated} rows` : 'dry run (pass --write to apply)')
```

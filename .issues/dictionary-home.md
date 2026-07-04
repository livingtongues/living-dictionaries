# Dictionary home page + per-dict featured-entry starring + global curation pivot

Design a "home" for each dictionary (eventually replacing the auto-redirect to /entries).
For now it lives at `/[dictionaryId]/home` with a side-menu link visible only to admin level 3
(no route gate — direct loads work for anyone). Iterate from there.

**STATUS: built + verified 2026-07-04 (all three workstreams). Awaiting Jacob's review.**

## Decisions (Jacob interview, 2026-07-04)

- **Full starring + reorder now** (not auto-pick placeholder). Editor+ can star AND reorder.
- **Sections (v1):** hero w/ `featured_image` backdrop + identity chips (ISO 639-3, glottocode,
  alt names, location), search box (deep-link to `/entries?q=`), featured-entries strip, stats
  band, about + grammar truncated snippets, map placeholder, gloss-language chips, cite card,
  recently-added strip, speakers stat, editor-only nudge card, semantic-domains chart **behind
  admin_level >= 3 with the admin icon**.
- **Admin-icon convention (NEW):** any admin-3-gated UI element gets a small shield icon
  (`~icons/fa6-solid/user-shield`, `.admin-gate-icon` in SideMenu) next to it. Applies to the
  side-menu Home link + the semantic-domains chart heading.
- **Stats:** browser-only. Pulsing skeleton (not literal zeros) until local Orama facets are
  ready, then count up (ease-out ~900ms). Stats: entries, with-audio, with-photos, with-video,
  speakers.
- **Featured strip data:** SSR from the server's `dictionaries/{id}.db` in `+page.server.ts`
  (instant paint); live dict_db takes over once open. Recently-added SSR'd in the same load
  (recent stays SSR-only, deduped against featured).
- **Map:** placeholder box only. No coordinates → hidden for viewers, dashed "Add a location"
  (→ settings) for managers.
- **Reorder v1:** hover/manage overlay per card (editor+): unstar + move left/right buttons.
  Drag-and-drop later.
- **Star placement v1:** entry detail action bar + unstar on home strip. NOT list/gallery rows.
- **Modal (global homepage cards only):** click opens `FeaturedEntryModal` (large photo,
  lexeme + phonetic, ALL glosses, audio + speaker name, example sentence, dict name/location →
  `/{dict_url}`, "Open entry" button) instead of navigating (navigation kicks off the dict's
  snapshot download). Modified/middle clicks keep default nav. Dict-home cards link straight
  to the entry page.
- **Editor stars → global bucket:** curate command sweeps server dict DBs' `featured_entries`
  into shared.db as `source='editor_star'` suggestions; `starred_at` (dict-db star created_at,
  MAX per dict) is the sweep watermark; full re-sweep allowed when the pool runs dry.
- Word-of-day: deferred. Domains chart stays admin-gated until fine-tuned.

## What was built

### Workstream A — dict home page ✅
- `routes/[dictionaryId]/home/`: `+page.server.ts` (SSR featured + recent + partners; typed via
  `PageServerLoadEvent` — a bare `: PageServerLoad` on a page WITHOUT a sibling `+page.ts` gets
  an output constraint demanding the universal-layout keys), `+page.svelte`, `HomeEntryCard`
  (photo card w/ hue-gradient fallback + audio + manage overlay), `HomeStats` (pulse →
  count-up), `MapPanel`, `DomainsPanel`, `NudgeCard`, `home-helpers.ts` (first_gloss,
  text_snippet, card_hue — inline vitest).
- SideMenu: Home link at top, `page.data.auth_user?.admin_level >= 3`, house icon + shield.
- EN i18n keys under `dict_home.*` (+ `home_v2.open_entry`).
- Stories: `_page.stories.ts` (Visitor / ManagerBareDict / AdminLoadedStats CSR),
  `HomeEntryCard.stories.ts`, `HomeStats.stories.ts`.

### Workstream B — starring (dict.db, synced) ✅
- `dictionary-migrations/20260704_featured_entries.sql`: table (id PK, entry_id UNIQUE FK
  CASCADE, sort_key fractional index, dirty + audit cols) + lmod bump triggers + re-declared
  `process_delete_cascade` including the new table.
- Registered: Drizzle `dictionary.ts`, `DICT_SYNCABLE_TABLES`, `TableModels` (types/db.ts),
  history `resolve_owners` (featured_entries → entry owner) + `TABLE_LABELS`.
- Star toggle on entry action bar (editor+, mdi star icons, `--warning` when starred); writes
  via `dict_db.featured_entries` insert/delete; reorder via `key_between`.
- Server read helpers `$lib/db/server/dict-home.ts` + tests (order, cascade, UNIQUE).
- v1 API parity (star/unstar/reorder endpoints): ✅ built 2026-07-04 —
  `GET/POST/PATCH /api/v1/dictionaries/[id]/featured-entries` + `DELETE …/[entryId]`,
  `$lib/db/server/v1-featured-entries.ts`, openapi paths, 10 tests
  (see `.issues/dictionary-home-followups.md`).

### Workstream C — global pipeline pivot ✅
- `shared-migrations/20260704a_featured_entries_pivot_and_dictionary_buckets.sql`: `source`, `phonetic`, `glosses`,
  `speaker_name`, `example_sentence`, `starred_at`.
- `featured-entries.ts`: parse JSON columns on read; `approved_featured_cards` bakes the modal
  fields + `dict_location`; `FeaturedCard`/`FeaturedExampleSentence` types extended.
- `FeaturedEntryModal.svelte` + WordCards click interception (plain left-click only) +
  `data-sveltekit-preload-data="tap"` on modal links.
- /admin/featured-words: source badge (editor star = warning tint) + phonetic/speaker/example
  markers on cards.
- `curate-featured-words.md` rewritten: bucket model, 5/dict fill, richer harvest SQL
  (modal fields via json_object), editor-star sweep w/ watermark, media-less stars skipped,
  backfill step for the 26 pre-pivot approved rows (**backfill = prod write, run with the next
  curation pass — offer to Jacob**).

## Verification done
- vitest 1231 passed; `pnpm check` 0 errors; lint clean.
- svelte-look screenshots: page (3 stories, light+dark, desktop+mobile), card, stats, modal.
- Headless e2e (`/tmp/dict-home-e2e.mjs`, dev server 3041, achi dict): 14/15 — SSR paint,
  pulse → count-up to 485, admin side-menu link, star×2, strip order = star order, move-right
  reorder, unstar, modal opens without navigating + Escape closes. Only failure = pre-existing
  dev noise (Google One Tap CORS + dummy Mapbox token in headless).
- Sync round-trip proven: browser star → push → server `achi.db` row; unstar → tombstone;
  fresh browser pulls snapshot with the row. (One demo row left starred on dev achi: Juyub'.)

## Lessons / gotchas
- **`dict_db.<table>.rows` in a bare `$derived` silently never updates** — use `.query()`
  accessors (see `.issues/dict-table-accessor-rows-reactivity.md`). The database skill
  documents the broken pattern; nothing else in the codebase used it.
- `get_dictionary_db()` CREATES the file when missing — SSR loads must `existsSync(
  dictionary_db_path(id))` first or dev machines accumulate empty dict DBs.
- New dict.db table checklist: migration SQL (+ bump triggers + re-declare
  process_delete_cascade), Drizzle schema, DICT_SYNCABLE_TABLES, TableModels, history
  resolve_owners + TABLE_LABELS. Client/schema-version plumbing is automatic (globs).
- An inline `<a>` card needs `display: block` or it collapses outside a flex strip.
- Page-story mocks: use `mock_t` + `as never` casts (contributors pattern).

## Iteration ideas already parked
- Real map (canvas Equal Earth reuse), drag-and-drop reorder, star on list/gallery rows,
  word-of-day, semantic-domains chart go-public, visitors-analytics stats, entries-list
  navigation not blocking on snapshot download, swap `/{dict}` redirect → home at go-live.

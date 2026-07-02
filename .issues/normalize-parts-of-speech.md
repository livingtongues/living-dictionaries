# Normalize parts of speech (v1 API + river data fix + `obj` mapping)

`/river/entries` shows raw `N (1097)`, `CONJ (21)`… in the POS facet because river's senses
store UPPERCASE POS abbreviations (imported 2026-07-01 via the `/api/v1` write API which does no
normalization), while the `ps.<key>` i18n lookup is case-sensitive with lowercase keys.

Scan result (prod, all dict DBs): only river has POS data — 2,549 senses, 12 distinct values, all
uppercase: `ADV N V PREP Q PRO CONJ NEG CLF INT OBJ DEM`. `OBJ` has no mapping entry at all.

Decisions (Jacob):
- Fix the data + normalize at the v1 write path (case-insensitive map to canonical lowercase
  abbrevs). NOT making display lookups case-insensitive.
- Teach API consumers the supported options well (openapi).
- Add `obj` → "object marker" to the ps locale files + parts-of-speech mapping.

## Plan

1. ✅ `site/src/lib/mappings/parts-of-speech.ts` — add `{ enAbbrev: 'obj', enName: 'object marker' }`
   + `normalize_part_of_speech` (case-insensitive match on enAbbrev, then enName → canonical
   lowercase abbrev; unknown values pass through verbatim — Mayan dicts store full Spanish phrases).
2. ✅ `site/src/lib/i18n/locales/ps/en.json` — add `"obj": "object marker"`;
   `psAbbrev/en.json` — add `"obj": "obj"`.
   ⚠️ These files are REGENERATED from a Google Sheet (`scripts/locales/update-locales.ts`,
   `I18N_GOOGLE_SHEET_ID`, tab `Parts-of-Speech`, columns `en,key,enAbbrev,esAbbrev,es`).
   Jacob must add a row (`object marker,obj,obj,…`) or the next `update-locales` wipes it.
3. ✅ `site/src/lib/db/server/v1-entry-write.ts` — normalize + dedupe parts_of_speech in
   `build_sense_rows` (POST) and `build_sense_patch_row` (PATCH).
4. ✅ `site/src/lib/api/v1/openapi.ts` — `parts_of_speech` description now lists all supported
   `abbrev (name)` pairs generated from the mapping + explains normalization behavior; guide
   Data-model section mentions it.
5. ✅ Tests: v1-entry-write.test.ts (POST + PATCH normalization, dedupe, unknown pass-through);
   inline mapping test.
6. ✅ Prod repair on living VPS: backup river.db → UPDATE the 2,549 senses with lowercased arrays +
   `updated_at = now` (trigger bumps `last_modified_at` → clients pull via /changes; next snapshot
   rebuild carries it). No history events for the repair (merge_dict_row path not available in
   container script) — acceptable for a data repair.
7. ✅ Verify: pnpm test + tsc + lint; prod query shows all-lowercase facets.

## Verification notes
- `sqlite3` not on VPS host — pipe node script into `docker exec -i sveltekit_blue node`.
- Pull sync = `WHERE updated_at > cursor` per table; bumping updated_at is sufficient.

## Outcome (2026-07-02) — DONE except two follow-ups for Jacob
- Repair ran on prod: `{scanned: 2549, changed: 2549, unknown: []}`; post-fix distinct values all
  canonical lowercase. Backup: `/data/dictionaries/river.db.bak-2026-07-02T02-56-52-813Z` (VACUUM
  INTO — delete once satisfied).
- Verified live with headless puppeteer on new.livingdictionaries.app/river/entries: facet shows
  `noun (1097)`, `conjunction (21)`, `question marker (40)`, … on the second load (first load's
  facets come from the pre-fix snapshot; deltas apply in background → labels correct on next load).
- pnpm vitest (touched modules) + tsc + eslint all clean.
- Knowledge: `.knowledge/domain/parts-of-speech-i18n.md`.

Follow-ups:
1. Jacob: add row `object marker,obj,obj` (en,key,enAbbrev; es columns blank for translators) to
   the `Parts-of-Speech` tab of the i18n Google Sheet, else the next `update-locales` run deletes
   the hand-added `obj` key from `ps/en.json` + `psAbbrev/en.json`.
2. Code changes (normalization, openapi docs, `obj` mapping/locales) need commit + deploy to
   `svelte-5-migration` — until deployed, the `obj (1)` facet on river shows raw `obj`.

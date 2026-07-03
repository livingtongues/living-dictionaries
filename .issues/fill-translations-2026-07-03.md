# Fill Translations (AI pass) — 2026-07-03

Running the `/fill-translations` procedure against production `shared.db` on the living VPS.

## Status snapshot (from prod query)
- Active keys: **981**
- en_changed queue: **0** → step 3 is a no-op
- Existing ai-flagged: **0**
- Missing translations total: **~2301** across 17 TRANSLATABLE_LOCALES
- Distinct missing keys: **347**

## Per-locale missing counts
es 86, fr 86, zh 81, sw 86, ru 168, he 162, pt 168, id 168, ms 192, bn 86, as 252, hi 80, vi 184, ha 168, ar 80, am 168, or 168

## Category shape
- **Core ~79 keys** missing in ALL locales: account.your_name, sync.* (6), entry_field.definition_english, map.webgl_unavailable, misc.* (7: reload/appearance/theme_*/app_update_needed/local_data_expired), settings.delete_dictionary, source.* (24), terms.privacy_policy, relationship_type.* (36), ps.obj
- **psAbbrev**: es/fr/sw/bn=7, zh=2, hi/ar/as=1, he=83, ru/pt/id/ms/vi/ha/am/or=89 (all)
- **gl (16 lang names)**: ms, vi, as
- **ms** also: ps 7, sd 2
- **as (Assamese)** is the big one: also about/contact/create/entry/video/history/print/import_page/etc (~150 extra) + gl 16 + sd 1

## Placeholders to preserve EXACTLY
- sync.tap_failed `{message}`
- entry.source / entry.source_message / entry.rights / entry.AI_generated `{media}` (only in `as`)

## Reference data pulled (local /tmp)
- /tmp/i18n-missing.json (per-locale missing + samples)
- /tmp/i18n-ref.json (existing ps/psAbbrev/sd/gl per locale)
- /tmp/i18n-anchors.json (recurring domain terms per locale)

## psAbbrev confidence policy
- FILLED full/near-full: ru, pt, id, ms, he, vi, am, or (derived from each locale's own full `ps.*` forms)
- SKIPPED (leave for human — weak/cryptic convention or rough source forms): sw (7 new abbrevs, cryptic existing scheme), ha (89 — Hausa full forms mostly English/rough)

## Authoring status (validated: coverage 100%, tokens OK)
es✅ fr✅ zh✅ sw✅(−7 abbr) bn✅ hi✅ ar✅ ru✅ pt✅ id✅ he✅ ms✅ vi✅ | remaining: ha, am, or, as

## Plan
- [x] Safety backup (r2/backups-rolling/db/living/2026-07-03T14-27-03Z.tar.zst)
- [x] Author per-locale translations → /tmp/tx/<locale>.json (all 17 validated)
- [x] Bulk INSERT ... ON CONFLICT DO NOTHING, source='ai', needs_review='ai', updated_by_name='AI (fill-translations)' — **2287 inserted, 0 conflict, 0 unknown-key**
- [x] Verify counts on prod — 15 locales 100%; sw 7 & ha 89 deferred; 2287 ai-flagged; 0 en_changed
- [x] `pnpm i18n:refresh` + verify diff — **pure empty→value fills, 0 removals, 0 real overwrites** (2287 changes)
- [x] i18n test suites pass (5 files / 20 tests). Whole-suite: only failure is PRE-EXISTING unrelated `log-analytics.test.ts` stale snapshot (fails with my changes stashed too)
- [ ] **AWAITING JACOB**: commit locale files + push main (deploy bakes values) — not done per "don't commit unless told"
- [ ] Remind: /translate "Notify translators" is now safe

## Result summary (per-locale inserted)
am168 ar80 as252 bn86 es86 fr86 ha79 he162 hi80 id168 ms192 or168 pt168 ru168 sw79 vi184 zh81 = **2287**
Deferred (unsure→human): sw psAbbrev×7 (cryptic existing scheme), ha psAbbrev×89 (Hausa source forms English/rough).

## Notes
- Primary container: **sveltekit_blue** (green = IS_STANDBY). better-sqlite3 at /workspace/node_modules/.pnpm/better-sqlite3@12.10.0/...
- ha/am/or existing translations are partial/rough (some still English) — produce proper values where confident.

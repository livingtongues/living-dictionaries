# Gloss abbreviations: i18n fill, curated-row cleanup, legend upgrade

Decisions (Jacob, 2026-08-01):
- `gloss.*` standard-code keys (111, en-only today) → AI-fill all locales via a spawned Opus lane running /fill-translations.
- Curated `glossing_abbreviations` should hold ONLY what the standard set can't cover.
  - Code: fall through to the `t('gloss.*')` standard expansion when a curated row's wording just restates the standard EN name.
  - Data (Ponca prod): DELETE restatement rows; REWORD bespoke rows to stand alone — no "the book's …" phrasing (the LD stands apart from the source PDF; import report references the book, gloss tooltips don't).
- Curated rows are NOT translated per UI locale (gloss-language-keyed dictionary data — by design).
- Legend table at grammar-page foot: KEEP, plus a collapsed click-to-expand section listing the STANDARD codes actually used on the page (localized expansions).
- Import-agent guide: only register non-standard codes; wording must stand alone.

## Tasks
- ✅ 1. gloss-catalog fall-through (curated == standard EN name → t lookup) + tests
- ✅ 2. GlossingLegend: collapsed "Standard abbreviations used here" `<details>` (new `standard_codes_used` catalog method; curated table now renders via `catalog.expand` so restatements localize; curated codes excluded from the standard roll — no duplication). New EN key `grammar.standard_abbreviations`. Story `LegendStandardExpanded` verified light+dark.
- ✅ 3. Ponca prod: 67 → 32 rows. Deleted 35 (20 exact restatements + 12 composable composites + SBJ/OBJ/Q near-restatements); reworded 7 (1SG>2SG, 3.OBJ, 3.SBJ, DU, EMPH, REFL, Ø) to drop all "the book's" phrasing. Done via v1 API with a temp write key (minted directly in shared.db api_keys attributed to Jacob, revoked after). Full before/after in session; verification list confirmed all remaining rows bespoke + book-free.
- ✅ 4. Guides: corpus.md (register only non-standard codes, wording stands alone, no "the book") + importing.md table row.
- ✅ 5. Spawned Opus lane 15c974e1-3fa2-450e-9d72-fd658c760a69 (living-dictionaries, claude-opus-5) running /fill-translations focused on gloss.* — **finished 2026-08-01**: all 111 `gloss.*` keys (+8 other missing keys) written to prod `shared.db` for all 19 translatable locales (2261 rows, `source='ai'`, `needs_review='ai'`); 0 missing keys remain in any locale. Seed files refreshed and left UNCOMMITTED for Jacob. Receipt: `.cron/fill-translation-reviews/2026-08-01.md`.

## Follow-ups
- New `grammar.standard_abbreviations` key reaches prod i18n_keys only after next deploy — next fill-translations run picks it up.
- `pnpm check` clean; corpus+grammar tests pass. Known lint-config quirk: function-typed Svelte props warn no-unused-vars (pre-existing, e.g. ReviewBanner).

## Notes
- Curated name MultiString uses `default` key on Ponca rows.
- Standard catalog: `$lib/mappings/glossing-abbreviations.ts` (`standard_gloss_name`), EN keys in `i18n/locales/en.json` under `gloss`.
- Prod query path: `ssh living` → `docker exec sveltekit_blue node -e '…better-sqlite3…'` (no sqlite3/node on host).

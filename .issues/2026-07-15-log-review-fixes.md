# 2026-07-14 LD review follow-ups (3 items)

Executing approved items from `.cron/log-reviews/2026-07-14.md` +
`~/code/horse/.cron/business-reviews/living-dictionaries-2026-07-14.md`.
Leave everything UNCOMMITTED for Jacob.

## Key architecture finding (drove decisions on #1 & #3)

The i18n system is DB-backed. `i18n_keys` is mirrored **only** from the EN catalog
(`sync_en_catalog` → `flatten_en()`). Both `seed_translations_if_empty` and
`upsert_translation` insert `... FROM i18n_keys WHERE id = ?` / throw "Unknown key" —
so **a non-English translation literally cannot exist for a key absent from the EN
catalog.** The missing-key telemetry (`report_missing_translation`) fires only when
BOTH the active locale AND English lack the key.

⇒ The durable, norm-compliant fix for a genuinely-missing key is to add it to the EN
catalog files (code-owned source of truth). That both (a) stops the telemetry for every
viewer and (b) creates the `i18n_keys` row so translators can fill non-English via
/translate. Editing a committed non-English file alone is NOT durable — the Dockerfile
bake regenerates those files from the prod DB (catalog keys only) at each deploy.

Verified locally (`.data/shared.db`): `ps.n.f`, `psAbbrev.n.f`, and `gl.default` are
absent from `i18n_keys` AND from every committed locale file — they exist nowhere. The
review's "gl.default translated in every locale except Hebrew" is inaccurate; it's
missing everywhere (only a Hebrew-locale user happened to view a `default`-bcp gloss in
the window, so only `he` logged it).

## 1) Italian POS: canonical `n.f` / `n.m` (structured, gender-marked nouns) ✅
- Stored POS abbrev `n.f` (via v1 API import of rusitene) renders `ps.n.f` /
  `psAbbrev.n.f` → missing-key warns during import.
- Added `n.f` (noun, feminine) + sibling `n.m` (noun, masculine) to the canonical set:
  `partsOfSpeech` (mapping/picker + openapi enum + normalize lookup), `ps/en.json`,
  `psAbbrev/en.json`. Stops the telemetry for every viewer regardless of UI/gloss
  language; makes future gender-marked imports normalize + render cleanly.
- NOTE: `it` is NOT a live UI locale (commented out in UnpublishedLocales) and has no
  locale files, so there is nowhere to durably store "Italian" POS strings today; the
  English-catalog fix is what actually closes the gap. Enabling `it` localization is a
  separate product decision — not done here.

## 2) Waveform decode failure (P3) — see summary for path taken
- `Waveform.svelte:80` bare `console.error(..., error)` serializes to `{}`.
- Decision: enrich the log with structured context (chosen over a speculative codec
  fix — see summary rationale).

## 3) Hebrew gl.default fill ✅
- Added `gl.default` to `gl/en.json` ("Default") so the key exists in the catalog
  (durable; stops telemetry for all locales) + Hebrew value to `gl/he.json`
  ("ברירת מחדל"). Prod Hebrew value also needs a /translate DB entry to survive the
  deploy bake (committed he.json is only the fresh-DB seed + fallback) — flagged for Jacob.

## Prod translation fill (after deploy of fb7f85ef) ✅
- Verified all 5 new keys landed in prod `i18n_keys` (sync_en_catalog at boot).
- Backed up prod DB → `r2/backups-rolling/db/living/2026-07-15T02-13-48Z`.
- Filled all 17 `TRANSLATABLE_LOCALES` × 5 keys = **85 rows** into prod
  `i18n_translations` (source='ai', needs_review='ai', 'AI (fill-translations)'),
  ON CONFLICT DO NOTHING. 0 pre-existing, 0 missing-key.
- Ran `pnpm i18n:refresh` → committed seed files now mirror prod (my 5 keys across
  all locales + legitimate translator drift + dead-key `synopsis` cleanup).
- Low-confidence AI guesses flagged for human review on /translate: the `psAbbrev.*`
  abbreviations for languages without a gendered-noun convention (sw, id, ms, vi, ha),
  and `gl.default` for ha ("Asali"). All are needs_review='ai' so a translator vets them.
- "Notify translators" on /translate is now safe to press.

## Verify
- `pnpm test` (i18n + POS + waveform-utils), `tsc`, `pnpm lint` — all green.

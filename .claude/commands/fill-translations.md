---
description: AI-fill missing i18n translations + triage en_changed review flags in the production DB, then refresh the committed seed files and push (which deploys + bakes them). Run after deploying new/changed English keys, BEFORE hitting "Notify translators".
---

# Fill Translations (AI pass)

You (the agent) are the translation engine — there is deliberately NO in-app AI button. You
generate the translations yourself and write them to the **production** `shared.db` on the
living VPS. Every AI write is flagged so a human translator reviews it on `/translate`
(except en_changed triage where you judge the flag unnecessary — see step 3).

Schema (see `$lib/server/i18n/i18n-db.ts`): `i18n_keys` (EN catalog, `removed_at IS NULL` =
active) + `i18n_translations` (UNIQUE (key_id, locale); `source` 'import'|'human'|'ai';
`needs_review` NULL|'ai'|'en_changed'). Locales = `TRANSLATABLE_LOCALES` in
`$lib/i18n/locales.ts` (published + unpublished, no `en`).

## 0. Safety

- `~/code/vps-setup/bin/backup-vps-db living` if today's cron backup hasn't run yet (check `mcli ls r2/backup/sqlite/living/`).
- All prod access rides the backup-vps-db pattern: `ssh living "docker exec sveltekit_blue node -e \"...\""` with better-sqlite3 opening `/data/shared.db` (WAL-safe). For anything beyond a trivial one-liner, write a script locally, `scp` it to the VPS, and `docker exec node /tmp/...` it (quoting sanity).
- For a local dev run instead of prod, open `site/.data/shared.db` directly with `site/node_modules/better-sqlite3`.

## 1. Query the work

Before writing, read the newest receipts in `.cron/fill-translation-reviews/` and count
`needs_review = 'ai'` rows per locale. Review debt is evidence to report, never permission to
clear flags or bypass the human gate.

```sql
-- Missing: active keys × locales with no row
SELECT k.id, k.en_value, loc.locale FROM i18n_keys k
CROSS JOIN (SELECT DISTINCT locale FROM translator_languages UNION SELECT locale FROM i18n_translations) loc  -- or enumerate TRANSLATABLE_LOCALES explicitly (preferred)
LEFT JOIN i18n_translations t ON t.key_id = k.id AND t.locale = loc.locale
WHERE k.removed_at IS NULL AND t.id IS NULL;

-- en_changed triage queue
SELECT t.key_id, t.locale, t.value, k.en_value FROM i18n_translations t
JOIN i18n_keys k ON k.id = t.key_id
WHERE t.needs_review = 'en_changed' AND k.removed_at IS NULL;
```

Enumerate locales explicitly from `TRANSLATABLE_LOCALES` — don't derive them from existing rows.

## 2. Fill missing values

Translate the English into each target language yourself, in per-locale batches. Rules:

- Preserve `{token}` placeholders EXACTLY (`{url}`, `{name}`, …) — never translate token names.
- Match the register of existing translations in that locale (query a few `source='human'` rows first for tone/terminology). These are UI strings: concise, imperative where English is imperative.
- `psAbbrev.*` keys are ABBREVIATIONS — produce that language's conventional abbreviation, not the full word (compare `ps.*` for the full form).
- `gl.*` are language names, `sd.*` semantic-domain labels — prefer that language's established terms.
- If genuinely unsure a language is safe for machine translation on some string (rare), skip it — leave it missing for the human.

Write with: `INSERT INTO i18n_translations (id, key_id, locale, value, source, needs_review, updated_by_name) VALUES (<uuid>, ?, ?, ?, 'ai', 'ai', 'AI (fill-translations)') ON CONFLICT (key_id, locale) DO NOTHING` (never clobber a concurrent human write; timestamps default).

## 3. Triage en_changed flags (Jacob's policy — don't wake translators needlessly)

For each `en_changed` row, compare the CURRENT English against the existing translation:

- **Still an accurate translation** (English change was trivial — capitalization, punctuation,
  typo fix): clear the flag, keep everything else: `UPDATE ... SET needs_review = NULL WHERE key_id = ? AND locale = ? AND needs_review = 'en_changed'`.
- **Translation needs a small mechanical update** (e.g. English gained a `{token}` or a word
  you're confident about): update it yourself → `SET value = ?, source = 'ai', needs_review = NULL, updated_by_name = 'AI (fill-translations)', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`.
- **Substantive meaning change**: draft your best updated translation but LEAVE it flagged →
  same UPDATE but `needs_review = 'ai'` (the translator sees "AI translation — please review").

## 4. Refresh the committed seed files + deploy

```bash
cd ~/code/living-dictionaries/site
pnpm i18n:refresh        # pulls prod /api/i18n/export → overwrites src/lib/i18n/locales/**
```

Verify the diff is sane (only expected locales/keys changed), run `pnpm test` on the i18n
suites, then commit the locale files (`i18n: AI translation fill YYYY-MM-DD`) and push to
`main` — that deploy bakes the new values into the app.

## 5. Report

Write `.cron/fill-translation-reviews/YYYY-MM-DD.md` with observed gaps, pre/post human-review
queue counts, backup evidence, per-locale fills, `en_changed` outcomes, skips, verification,
commit/push result, and exactly one terminal state: `staged-for-human-review`, `clean-no-op`,
`partial`, `blocked`, or `accepted`. Reserve `accepted` for evidence that humans completed the
review queue; a successful AI pass is `staged-for-human-review`. Tell Jacob the same compact result
and remind him the "Notify translators" button on `/translate` is safe to press.

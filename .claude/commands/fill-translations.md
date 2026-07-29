---
description: AI-fill missing i18n translations + triage en_changed review flags in the production DB, then refresh the committed seed files and LEAVE THEM UNCOMMITTED for Jacob to review. Run after deploying new/changed English keys, BEFORE hitting "Notify translators".
---

# Fill Translations (AI pass)

**Who spawns you.** Since 2026-07-28 this is **writer subwave `2b` of the horse nightly fleet**
(`~/code/horse/.cron/fleet.md`), spawned on Mondays by the nightly orchestrator — it is no longer a
standalone wall-clock cron. That matters to you in three ways: no other lane is writing Living
Dictionaries while you run (so you may assume a clean tree, and the only uncommitted changes at the
end are yours — the refreshed locale seed files, which you leave for Jacob), you get one casualty
re-run if you die on a provider error, and your receipt is read by the morning brief. You can still
be run by hand at any time, which is the normal way to use it after deploying new English keys.

You (the agent) are the translation engine — there is deliberately NO in-app AI button. You
generate the translations yourself and write them to the **production** `shared.db` on the
living VPS. Every AI write is flagged so a human translator reviews it on `/translate`
(except en_changed triage where you judge the flag unnecessary — see step 3).

Schema (see `$lib/server/i18n/i18n-db.ts`): `i18n_keys` (EN catalog, `removed_at IS NULL` =
active) + `i18n_translations` (UNIQUE (key_id, locale); `source` 'import'|'human'|'ai';
`needs_review` NULL|'ai'|'en_changed'). Locales = `TRANSLATABLE_LOCALES` in
`$lib/i18n/locales.ts` (published + unpublished, no `en`).

## 0. Safety

- `~/code/vps-setup/bin/backup-vps-db living` if today's cron backup hasn't run yet (check `mcli ls r2/backups-rolling/db/living/`).
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

## 4. Refresh the seed files — and STOP there

```bash
cd ~/code/living-dictionaries/site
pnpm i18n:refresh        # pulls prod /api/i18n/export → overwrites src/lib/i18n/locales/**
```

Verify the diff is sane (only expected locales/keys changed) and run `pnpm test` on the i18n
suites. Then **leave the locale files uncommitted.**

> **You NEVER commit and NEVER push** (2026-07-29, Jacob — see
> `.cron/fill-translation-reviews/decisions.md`). This lane has the same contract as every
> other worker: make the changes, leave them in the working tree, report. A push to `main` is
> a **deploy** of the whole site, and that decision is Jacob's, not a nightly lane's. He reviews
> the seed diff and commits it himself — which is what bakes the values into the app.
>
> Writing the production `shared.db` is still yours to do: that is the lane's product, it is
> flagged for human review on `/translate`, and it is live the moment you write it. The bundled
> seed files are only the fallback copy.

Do not offer to push, do not ask for permission to push, and do not re-propose push
authorization.

## 5. Report

Write `.cron/fill-translation-reviews/YYYY-MM-DD.md` with observed gaps, pre/post human-review
queue counts, backup evidence, per-locale fills, `en_changed` outcomes, skips, verification, the
uncommitted seed diff you left behind (files + line counts), and exactly one terminal state:
`staged-for-human-review`, `clean-no-op`, `partial`, `blocked`, or `accepted`. Reserve `accepted`
for evidence that humans completed the review queue; a successful AI pass is
`staged-for-human-review`. Tell Jacob the same compact result, name the uncommitted files waiting
for him, and remind him the "Notify translators" button on `/translate` is safe to press.

**If production is unreachable or the seed diff looks wrong, STOP and report `blocked`.** Then ping
`poly_pings` with the one-line result (terminal state + per-locale fill count) so Jacob knows the
pass ran without opening the session — this replaces the spawn notification the standalone cron
used to send.

# Publish Arabic + German interface locales, add "volunteer to review" recruiting

Triggered by an email from Michel asking for Arabic + German interface languages.

## Goal

1. **Publish Arabic** (currently admin-only `UnpublishedLocales`) and **add + publish German**
   (doesn't exist yet) as normal interface languages everyone can pick.
2. In the **language switcher only** (no site-wide banner — Jacob's call), any published
   non-English locale with **no assigned translator** shows a "needs a reviewer" badge + a
   one-click **Volunteer to review** button. Clicking it (login required) fires a contact-form
   thread for that specific language so the team can follow up and assign them.
3. AI-fill **German fully** + top-off the **~82-key global gap** (every published locale currently
   maxes at 1020/1102 keys) in the prod DB, all flagged for human review.

## Design decisions (settled with Jacob)

- **No third "needs_review" tier.** Keep the two-group model in `$lib/i18n/locales.ts`:
  `Locales` (published, public) vs `UnpublishedLocales` (admin-only 🔑). Publishing = moving a
  locale into `Locales`. Promote `ar`, add `de`.
- **"Needs a reviewer" is DYNAMIC**, derived from `translator_languages`: a published, non-English
  locale with **zero** `translator_languages` rows shows the badge. Assign someone → badge vanishes
  automatically. No manual per-locale status flag (Jacob: "we move too fast for any language to be
  fully human-reviewed, so recruit wherever nobody's assigned").
- **Volunteer routing** = reuse the public `/api/contact` proxy (injects the internal secret
  server-side → `/api/messages/contact`) with a new `subject_key: 'translate_volunteer'`. Creates an
  `/admin/messages` thread + ntfy ping + AI triage. **Notify-only** — an admin then assigns the
  locale on `/admin/users/[id]`. No auto-role grant.
- **Force login to volunteer** — the button opens the LoginModal when logged out, so we always
  capture a real account (name/email) to assign later.
- **Switcher-only surface** — no reload banner. Badge + volunteer affordance live inside the
  `SelectLanguage` modal.

## Key findings (from codebase)

- `getSupportedLocale()` (drives the active locale in `+layout.ts`) only recognizes `Locales`, NOT
  `UnpublishedLocales` → today an admin picking Arabic actually renders **English** (the "preview"
  never worked). Moving `ar`/`de` into `Locales` fixes viewing + lists them for everyone.
- **Arabic is already fully baked**: `ar.json` + all 4 section files (`gl/ps/psAbbrev/sd/ar.json`)
  exist and are ~93% filled (1020/1102, same as every "solid" language); `page.direction = rtl`.
  Publishing needs only the enum move.
- **German has zero files.** The runtime loader (`getTranslator` in `$lib/i18n/index.ts`)
  hard-`import()`s all 5 files per locale — a missing `de.json` would throw. Fix: add try/catch
  resilience to the loader (graceful English fallback) so a locale can be added before its files are
  baked, then let the normal DB→export→bake pipeline generate the files.
- Runtime serves the **baked/committed** locale files, not the DB. The DB (`i18n_keys` +
  `i18n_translations` in shared.db) is read only by `/translate` and `/api/i18n/export`; each deploy
  bakes current prod-DB values into the served files (`site/scripts/fetch-baked-i18n.mjs` fetches
  export from the still-running old container).
- `page.data.auth_user` exposes `.user` (logged-in), `.translator_locales`, `.is_admin`.
- Adding `locales_with_translators` to `+layout.server.ts`'s return surfaces it in `page.data`
  (SvelteKit merges server + universal load returns).

## Implementation — Phase A (code, testable locally) ✅ DONE

- ✅ `$lib/i18n/locales.ts`: moved `ar` from `UnpublishedLocales` → `Locales`; added `de = 'Deutsch'`
      to `Locales`. (TRANSLATABLE_LOCALES auto-updates: `ar` already in it; `de` newly added.)
- ✅ `$lib/i18n/index.ts` `getTranslator`: `load_locale_file()` wraps each of the 5 dynamic
      `import()`s so a missing file → `{}` (graceful English fallback) instead of throwing. Verified:
      `/?lang=de` → HTTP 200 English fallback, no "Unknown variable dynamic import".
- ✅ `+layout.server.ts`: added `locales_with_translators` (`SELECT DISTINCT locale FROM
      translator_languages`, fail-open on error) to the returned data.
- ✅ `SelectLanguage.svelte`: rebuilt as a row list. Each published non-`en` locale NOT in
      `locales_with_translators` shows a "Volunteer to review" button (hand-heart icon). Logged out →
      opens `LoginModal`, then auto-sends on sign-in (`$effect` on `pending`). Logged in →
      `api_contact({ subject_key: 'translate_volunteer', ... })` → success toast + ✓ "Needs a
      reviewer" on that row. Admin still sees unpublished 🔑 rows (no volunteer button).
- ✅ New EN i18n keys in `locales/en.json`: `header.needs_reviewer`, `header.volunteer_to_review`,
      `header.volunteer_sent` (with `{language}` token), `header.volunteer_failed`,
      `contact.translate_volunteer` (subject label).
- ✅ `SelectLanguage.stories.ts`: SignedIn / AsAdmin / LoggedOut states with a real-EN `t` mock.
- ✅ Verification: `tsc` 0 errors · `pnpm lint` clean · `pnpm check` 0 errors (my files no
      warnings) · full `pnpm test` 1655 passed · svelte-look screenshots (light+dark) show volunteer
      prompt only on uncovered locales · end-to-end `/api/contact` w/ `translate_volunteer` created a
      `message_threads` row + message in shared.db (test row cleaned up).

Note: local dev `.env` has no `INTERNAL_INGEST_SECRET`, so `/api/contact` 500s there (pre-existing —
the existing Contact modal fails too); tested by launching dev with the secret injected.

## Implementation — Phase B (content, prod) ✅ DONE (deploy 2 pending Jacob)

- ✅ Backed up prod DB (8.5M → r2/backups-rolling/db/living/2026-07-15T10-37-42Z).
- ✅ Queried prod: 1163 active keys. German missing ALL 1163; every other locale missing the SAME
      62-key gap (structured-grammar/discourse/text_tag + settings.dialects + dict_home.view_cover_image
      + the 5 new volunteer keys). `en_changed` queue = 0 (no triage needed).
- ✅ Authored + validated translations in `/tmp/fill/`: German 1163 (base 608, gl 303, ps 91,
      psAbbrev 91, sd 70) + the 62-key gap × 17 locales = **2217 total**. All key-coverage + token
      (`{language}`, `{media}`, …) + non-empty checks passed.
- ✅ Inserted into prod `shared.db` via `docker exec sveltekit_blue node /tmp/fill-insert.cjs`:
      `source='ai'`, `needs_review='ai'`, `updated_by_name='AI (fill-translations)'`, ON CONFLICT DO
      NOTHING. **2217 inserted, 0 conflicts. de now 1163/1163.**
- ✅ `pnpm i18n:refresh` → created `de.json` + `gl/ps/psAbbrev/sd/de.json`, filled the 62-key gap in
      all 17 other base files. Verified: **0 existing translations lost, 0 changed, exactly 62 filled
      per locale**; German files 1163/1163; `de.page.direction='ltr'`. i18n tests 20/20, tsc 0 errors.
- ✅ **DEPLOY 2:** commit locale files + switcher rework + push → bake ships German + gap fills.

## Note: Jacob reworked the switcher live
Jacob edited `SelectLanguage.svelte` → compact PILL layout + a single contextual "Volunteer to
review" prompt for the ACTIVE locale (instead of my per-row buttons). CSS reconciled to match
(`.locale-pills` / `.locale-pill` / `.volunteer`; dead `.locale-list` / `.locale-row` /
`.locale-switch` removed).

## Ordering / gotchas

- Loader resilience must ship in the SAME deploy that adds `de` to `Locales` (else a German
  selection crashes before `de.*` files exist). Interim window: German shows English until Phase B's
  refresh bakes the content — acceptable, short, deploy-controlled.
- `export`/`upsert_translation` gate on `TRANSLATABLE_LOCALES`, but the fill-translations command
  writes raw SQL (bypasses the gate); `/api/i18n/export` only emits `de` once `de` is deployed in
  `TRANSLATABLE_LOCALES` — so run Phase A deploy before the Phase B `i18n:refresh`.
- `subject_key='translate_volunteer'` is free-form; unknown keys fall through to the generic
  thread + notify path (no special server routing needed).

## Status
Phase A: ✅ DONE + deployed (commit `e3da7661`). Phase B: ✅ prod DB filled + locale files refreshed
+ switcher rework included; deploy-2 commit/push in progress.

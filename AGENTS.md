---
include: [WEB.md]
---

# Living Dictionaries Architecture - dev runs on port 3041

A language-documentation web app served at `livingdictionaries.app` for communities to build a dictionary of **entries** (words/phrases), **sentences**, and **texts** that can have audio, photos, and video. 

The app runs on SQLite + a VPS. It's committed on and deployed from **`main`** — a push to `main` triggers the VPS deploy webhook.

### Additional tech stack

- **Media:** bytes live on **GCS** (presigned PUT upload; serving URLs built in `src/lib/helpers/media-url.ts` from `PUBLIC_STORAGE_BUCKET`). Photos use App Engine Images `lh3` serving URLs (see `.knowledge/domain/media-serving-urls.md`). In dev there's no GCS bucket: uploads are served from a local `/api/dev-media` store, while pulled photos still hit the public lh3 CDN.
- **Search**: local **Orama** index built from the wa-sqlite DB.
- **Telemetry:** browser + server logs POST to `/api/log` → `client_logs`, which since 2026-07-05 lives in its own server-only **`logs.db`** (`src/lib/db/server/logs-db.ts`, split out of shared.db at boot; aged rows → `logs-archive.db`). The forever rollups `log_daily_metrics` + `log_daily_sessions` + `dictionary_daily_views` (per-dict daily distinct-session counts) + `dictionary_monthly_visitors` (TRUE monthly-unique visitors — a whole-month UNION of cookieless `visitor_id`s per dict AND a site-wide `__site__` scope, recomputed from raw each sweep then frozen so it outlives the 60d prune; feeds the "Top dictionaries by unique visitors" panel + the future public "visitors/month" badge) stay in `shared.db`, never pruned. `/admin/analytics` reads via `get_log_analytics` (3-tier: shared.db rollups ≤ the retention watermark, live `logs.db` scans for the tail); the retention cron rolls forward from the watermark. Neither raw-log file is backed up — see the **check-logs** skill.
- **Styling**: hand-written scoped CSS + a small global layer driven by CSS custom properties. The root layout (`src/routes/+layout.svelte`) globally imports, in order: `./reset.css` (verbatim Tailwind-style reset in a low-priority `layer(reset)`; theme.css points its `--default-border-color` at a mode-aware mix), `$lib/typography.css` (`tw-prose` rich-text styles, theme-var based), `$lib/theme.css` (semantic vars + body paint + the deliberate diacritics-safe font stack — never "modernize" it to system-ui), `$lib/buttons.css` (`.btn-*`), `$lib/forms.css` (skill-styled form **element** styles on theme vars — the old `.form-input` class is gone) and `./global.css` (the reset forks in `svg { display: inline-block; vertical-align: middle }` and vite sets `Icons({ scale: 1 })`, so icons are 1em with no per-icon shim — the old `icons.css` is gone). **Dark mode is LIVE (2026-07-02)**: system preference via theme.css's `prefers-color-scheme` block + a 3-way user toggle (`$lib/dark-mode.ts`, `ColorSchemeToggle` in UserMenu + Footer, localStorage `color_scheme`, body class override); print is force-lighted at the end of theme.css. Icons are ALL `unplugin-icons` (`~icons/*`) components — the Font Awesome Kit script is gone from `app.html` (2026-07-12; ex-Pro glyphs provisionally use `~icons/fa-solid`, final picks via the temporary `/admin/icon-review` page). Legacy `ui/Button.svelte` is deleted — buttons are `HeadlessButton` + `.btn-*` classes.
- **R2:** DB **snapshots** (built by `src/lib/db/server/r2-snapshot-builder.ts`, restored via `src/lib/db/dict-client/fetch-snapshot.ts`) + admin **message attachments** (`src/lib/r2/*`). R2 vars are `$env/dynamic/private` (runtime, not preflight-gated).
- **i18n:** English lives in code (`site/src/lib/i18n/locales/*en.json` — add keys to the EN files only); every other language lives in shared.db (`i18n_keys` mirrors the EN catalog at boot; `i18n_translations` holds values). Translators edit at **/translate** (gated by `translator_languages`, assigned on /admin/users/[id]; admins see every locale + a progress/notify panel). Deploys bake DB values into the bundle: the Dockerfile fetches `/api/i18n/export` from the still-running site and overwrites the locale files (committed files = seed + fallback). AI gap-fill/review-triage is the `/fill-translations` slash command (no in-app AI button). The Google Sheet + `scripts/locales/` are retired; `glossing-languages-list.json` is hand-edited now.

## Additional Key Directories

- Shared TS types live in `src/lib/types` (Drizzle-derived).
- `scripts/` — standalone data tooling (its own lockfile; NOT a workspace member — install with
  `pnpm install --ignore-workspace`, else pnpm installs the root workspace instead). All legacy
  Supabase/import tooling is deleted (2026-07-17; git history has it) — what remains is
  one-off/`.cjs` prod-DB scripts + small helpers. `scripts/supabase-creds.private` (gitignored)
  is kept for legacy data access; the connector code would come from git history if ever needed.

## Domain data model
Text fields that vary by language are "MultiString" — a map of `{ <locale>: "…" }`.
- **Dictionary** — catalog metadata: name, url slug, public/private, language/gloss languages,
  coordinates / where-spoken, settings, entry_count, partners.
- **Entry** — `lexeme` (MultiString), `phonetic`, `notes`, `morphology`, `interlinearization`.
- **Sense** (child of entry) — glosses (MultiString per gloss-language), parts of speech, semantic
  domains, definition.
- **Sentence** — example text + translation (MultiString); linked to senses; can belong to a text.
- **Speaker** — name, decade of birth, gender, regional metadata.
- **Audio / Photo / Video** — media rows with a storage path + serving url; linked to
  entries/senses/sentences and (for audio) to speakers.
- **Dialect**, **Tag** — labels attached to entries. **User**, per-dict role
  (manager/contributor — there is NO 'editor' role), **invite**, **partner**.

Authoritative shapes: `site/src/lib/types/` (Drizzle-derived) and the schemas in
`site/src/lib/db/schemas/`. Related-entries design rationale: `.knowledge/domain/related-entries-model.md`.

## Routes (high level)
`/` (homepage — canvas Equal Earth map of dictionaries + hero search, curated word-card strip,
build-baked stats, features grid; see `.knowledge/domain/homepage-v2.md`) · `/about` ·
`/tutorials` · `/dictionaries` · `/account` ·
`/create-dictionary` · `/[dictionaryId]/*` (bare `/{dict}` IS the dictionary home page — hero
with in-place manager editing of catalog fields [name, codes, languages, orthographies, location,
cover image], starred "featured entries" strip [synced dict.db `featured_entries`, star toggle on
entry pages for managers], stats, about/grammar snippets — plus `entries` list — unified search
with Words·Sentences·Texts scope chips [admin-3 preview; the texts/sentences corpus pipeline, see
`.issues/texts-sentences-pipeline.md`] — entry detail, sentence detail, `texts` browse +
`texts/new` paste-to-sentences ingest + `text/[id]` reader [same admin-3 preview, route-guarded
via `$lib/corpus/corpus-preview-guard.ts` — lift at GA] — settings (public/print
toggles + delete + a dialects manager [manager: rename / map areal-extent geometry via
GeoTaggingModal / delete]; catalog fields moved to home), about,
contributors, grammar, history, export, import [manager-only, agent-driven: upload ANY-format resources → per-file instructions → "request import" creates a Diego-assigned message thread; files live in shared.db `source_files` (server-only) + R2 `import/{dict}/{file}`, served via `/api/v1/dictionaries/{id}/files/*`], invite) · `/chat` (standalone membership-based
chat — DB-managed channels + DMs for admins, super managers, and partners; server-authoritative
via `/api/chat/*` polling, gate = admin OR a `users.chat_access` grant (toggled on /admin/users/[id]) OR member of ≥1 room — one circle, any chat member can DM any other; `admin_room` channels manageable only by
super admins) · `/translate` (standalone translator backend — server-authoritative via
`/api/translate/*`, gate = ≥1 `translator_languages` row or admin) · `/admin/*` (local-first super-admin: dashboard + ntfy onboarding, messages incl.
unmatched→match + AI triage, users, dictionaries [paginated table w/ serve/tolerate/delete bucket
triage via `dictionaries.bucket`; `bucket='secure'` is ENFORCED — direct-role holders + level-3
admins only, everyone else sees the unknown-slug redirect/404, no public R2 snapshot; rule lives
in `$lib/db/server/secure-dictionary.ts` + `verify_auth_dict_role`], analytics, schema graph,
sync, triage-examples, legal-review, featured-words) · `/og` (share image) · `/terms` ·
`/privacy-policy` · `/setlocale`.

Inbound email is AI-triaged by `$lib/agent/*` (xAI Grok, env-gated on `XAI_API_KEY`; classifies →
auto-assigns/auto-resolves → drafts a reply); mail addressed to an admin's own alias (jacob@…)
skips triage and deterministically assigns to that admin. See `.knowledge/admin/ai-triage-pipeline.md`.
Agent-facing format-import guides are served at `/api/v1/guides` (markdown in `$lib/api/v1/guides/`)
and rendered on /admin/api-docs.

## Human/agent editing parity (a direction we're walking toward)
The agent-facing `/api/v1` write API (per-dict API keys, `openapi.json`, `$lib/db/server/v1-*`) and
the human editing UI should reach **full feature parity** — anything a human can edit, an agent can
edit, and vice-versa, ideally through the same validated server helpers. We don't need it all at
once; when adding an editing feature, add (or plan) both surfaces and prefer routing them through one
shared server module (e.g. orthographies: `$lib/db/server/orthographies.ts` backs both the v1
endpoints and the dictionary-home catalog write).


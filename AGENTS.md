---
include: [WEB.md]
---

# Living Dictionaries Architecture - dev runs on port 3041

A language-documentation web app served at `livingdictionaries.app` for communities to build a dictionary of **entries** (words/phrases), **sentences**, and **texts** that can have audio, photos, and video. 

The app runs on SQLite + a VPS. It's committed on and deployed from **`main`** — a push to `main` triggers the VPS deploy webhook.

### Additional tech stack

- **Media:** bytes live on **GCS** (presigned PUT upload; serving URLs built in `src/lib/helpers/media-url.ts` from `PUBLIC_STORAGE_BUCKET`). Photos use App Engine Images `lh3` serving URLs (see `.knowledge/domain/media-serving-urls.md`). In dev there's no GCS bucket: uploads are served from a local `/api/dev-media` store, while pulled photos still hit the public lh3 CDN.
- **Search**: local **Orama** index built from the wa-sqlite DB.
- **Telemetry:** browser + server logs POST to `/api/log` → `client_logs`, which since 2026-07-05 lives in its own server-only **`logs.db`** (`src/lib/db/server/logs-db.ts`, split out of shared.db at boot; aged rows → `logs-archive.db`). The forever rollups `log_daily_metrics` + `log_daily_sessions` stay in `shared.db`. `/admin/analytics` reads via `get_log_analytics` (3-tier: shared.db rollups ≤ the retention watermark, live `logs.db` scans for the tail); the retention cron rolls forward from the watermark. Neither raw-log file is backed up — see the **check-logs** skill.
- **Styling**: hand-written scoped CSS + a small global layer driven by CSS custom properties. The root layout (`src/routes/+layout.svelte`) globally imports, in order: `./reset.css` (verbatim Tailwind-style reset in a low-priority `layer(reset)`; theme.css points its `--default-border-color` at a mode-aware mix), `$lib/typography.css` (`tw-prose` rich-text styles, theme-var based), `$lib/theme.css` (semantic vars + body paint + the deliberate diacritics-safe font stack — never "modernize" it to system-ui), `$lib/buttons.css` (`.btn-*`), `$lib/forms.css` (skill-styled form **element** styles on theme vars — the old `.form-input` class is gone), `$lib/icons.css` (`.icon-inline` shim: icon components render 1em/inline-block/middle) and `./global.css`. **Dark mode is LIVE (2026-07-02)**: system preference via theme.css's `prefers-color-scheme` block + a 3-way user toggle (`$lib/dark-mode.ts`, `ColorSchemeToggle` in UserMenu + Footer, localStorage `color_scheme`, body class override); print is force-lighted at the end of theme.css. Icons are `unplugin-icons` (`~icons/*`) components, except legacy **Font Awesome Kit** `<i class="fas fa-x">` tags (kit script in `app.html`) which are kept for now — replacing them with identical-glyph `~icons/fa-*` components is a logged improvement.
- **R2:** DB **snapshots** (built by `src/lib/db/server/r2-snapshot-builder.ts`, restored via `src/lib/db/dict-client/fetch-snapshot.ts`) + admin **message attachments** (`src/lib/r2/*`). R2 vars are `$env/dynamic/private` (runtime, not preflight-gated).
- **i18n:** English lives in code (`site/src/lib/i18n/locales/*en.json` — add keys to the EN files only); every other language lives in shared.db (`i18n_keys` mirrors the EN catalog at boot; `i18n_translations` holds values). Translators edit at **/translate** (gated by `translator_languages`, assigned on /admin/users/[id]; admins see every locale + a progress/notify panel). Deploys bake DB values into the bundle: the Dockerfile fetches `/api/i18n/export` from the still-running site and overwrites the locale files (committed files = seed + fallback). AI gap-fill/review-triage is the `/fill-translations` slash command (no in-app AI button). The Google Sheet + `scripts/locales/` are retired; `glossing-languages-list.json` is hand-edited now.

## Additional Key Directories

- Shared TS types live in `src/lib/types` (Drizzle-derived).
- `scripts/` — standalone data/migration tooling (its own lockfile; NOT a workspace member — install
  with `pnpm install --ignore-workspace`, else pnpm installs the root workspace instead). Several
  tools still target the legacy platform and await porting to SQLite — the full keep/port/delete
  inventory lives in `.issues/post-cutover-teardown.md`.

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
  (manager/editor/contributor), **invite**, **partner**.

Authoritative shapes: `site/src/lib/types/` (Drizzle-derived) and the schemas in
`site/src/lib/db/schemas/`. Related-entries design rationale: `.knowledge/domain/related-entries-model.md`.

## Routes (high level)
`/` (homepage — canvas Equal Earth map of dictionaries + hero search, curated word-card strip,
build-baked stats, features grid; see `.knowledge/domain/homepage-v2.md`) · `/about` ·
`/tutorials` · `/dictionaries` · `/account` ·
`/create-dictionary` · `/[dictionaryId]/*` (entries list — unified search with
Words·Sentences·Texts scope chips [admin-3 preview; the texts/sentences corpus pipeline, see
`.issues/texts-sentences-pipeline.md`] — entry detail, sentence detail, `texts` browse +
`texts/new` paste-to-sentences ingest + `text/[id]` reader [same admin-3 preview, route-guarded
via `$lib/corpus/corpus-preview-guard.ts` — lift at GA] — settings, about,
contributors, grammar, history, export, import, invite, and `home` — the dictionary home page:
starred "featured entries" strip [synced dict.db `featured_entries`, star toggle on entry pages
for editor+], stats, about/grammar snippets; side-menu-linked for admin 3 only while iterated on,
eventually replaces the `/{dict}` → entries redirect) · `/chat` (standalone membership-based
chat — DB-managed channels + DMs for admins, super managers, and partners; server-authoritative
via `/api/chat/*` polling, gate = member of ≥1 room, `admin_room` channels manageable only by
super admins) · `/translate` (standalone translator backend — server-authoritative via
`/api/translate/*`, gate = ≥1 `translator_languages` row or admin) · `/admin/*` (local-first super-admin: dashboard + ntfy onboarding, messages incl.
unmatched→match + AI triage, users, dictionaries, buckets [serve/tolerate/delete triage of every
dict via `dictionaries.bucket`], analytics, schema graph, sync, triage-examples,
legal-review, featured-words) · `/og` (share image) · `/terms` · `/privacy-policy` · `/setlocale`.

Inbound email is AI-triaged by `$lib/agent/*` (xAI Grok, env-gated on `XAI_API_KEY`; classifies →
auto-assigns/auto-resolves → drafts a reply). See `.knowledge/admin/ai-triage-pipeline.md`.

## Human/agent editing parity (a direction we're walking toward)
The agent-facing `/api/v1` write API (per-dict API keys, `openapi.json`, `$lib/db/server/v1-*`) and
the human editing UI should reach **full feature parity** — anything a human can edit, an agent can
edit, and vice-versa, ideally through the same validated server helpers. We don't need it all at
once; when adding an editing feature, add (or plan) both surfaces and prefer routing them through one
shared server module (e.g. orthographies: `$lib/db/server/orthographies.ts` backs both the v1
endpoints and the settings-page catalog write).


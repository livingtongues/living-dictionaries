---
include: [WEB.md]
---

# Living Dictionaries Architecture - dev runs on port 3041

A language-documentation web app served at `livingdictionaries.app` for communities to build a dictionary of **entries** (words/phrases), **sentences**, and **texts** that can have audio, photos, and video. 

The app runs on SQLite + a VPS (migrated from Supabase + Vercel; production cutover completed 2026-07). It's committed on and deployed from **`main`** — a push to `main` triggers the VPS deploy webhook.

Note that `~/code/living-dictionaries-example` is an earlier abandoned "all-at-once" port, kept **read-only** as a parts-bin. Peek across the fence for patterns / copy self-contained modules; never bulk-import its infrastructure. It may be completely picked apart by now but there may still be a few scraps remaining left to learn from.

### Additional tech stack

- **Media:** bytes live on **GCS** (presigned PUT upload; serving URLs built in `src/lib/helpers/media-url.ts` from `PUBLIC_STORAGE_BUCKET`).Photos use App Engine Images `lh3` serving URLs (see `.knowledge/domain/media-serving-urls.md`). In dev there's no GCS bucket: uploads are served from a local `/api/dev-media` store, while pulled photos still hit the public lh3 CDN.
- **Search**: local **Orama** index built from the wa-sqlite DB.
- **Styling**: hand-written scoped CSS + a small global layer driven by CSS custom properties (**UnoCSS was fully removed 2026-06-12** — see `.issues/drop-unocss.md`). The root layout (`src/routes/+layout.svelte`) globally imports, in order: `./reset.css` (verbatim Tailwind-style reset in a low-priority `layer(reset)`; theme.css points its `--un-default-border-color` at a mode-aware mix), `$lib/uno-preflights.css` (captured `--un-*` var initializers — the vendored `sp-*` svelte-pieces shadows depend on them), `$lib/typography.css` (`tw-prose` rich-text styles, theme-var based), `$lib/theme.css` (semantic vars + body paint + the deliberate diacritics-safe font stack — never "modernize" it to system-ui), `$lib/buttons.css` (`.btn-*`), `$lib/forms.css` (skill-styled form **element** styles on theme vars — the old `.form-input` class is gone), `$lib/icons.css` (`.icon-inline` shim: converted icons render 1em/inline-block/middle like presetIcons did) and `./global.css`. **Dark mode is LIVE (2026-07-02)**: system preference via theme.css's `prefers-color-scheme` block + a 3-way user toggle (`$lib/dark-mode.ts`, `ColorSchemeToggle` in UserMenu + Footer, localStorage `color_scheme`, body class override); print is force-lighted at the end of theme.css. Icons are `unplugin-icons` (`~icons/*`) components, except legacy **Font Awesome Kit** `<i class="fas fa-x">` tags (kit script in `app.html`) which are kept for now — replacing them with identical-glyph `~icons/fa-*` components is a logged improvement.
- **R2:** DB **snapshots** (built by `src/lib/db/server/r2-snapshot-builder.ts`, restored via `src/lib/db/dict-client/fetch-snapshot.ts`) + admin **message attachments** (`src/lib/r2/*`). R2 vars are `$env/dynamic/private` (runtime, not preflight-gated).
- **i18n:** EN strings in `site/src/lib/i18n/locales/en.json`; other languages are filled by human translators (regenerated from `scripts/locales/` via `pnpm --filter scripts update-locales`) — add keys to `en.json` only.

## Additional Key Directories

- Shared TS types live in `src/lib/types` (Drizzle-derived).
- `scripts/` — standalone data/migration tooling (its own lockfile; NOT a workspace member — install
  with `pnpm install --ignore-workspace`, else pnpm installs the root workspace instead). The
  Supabase→SQLite cutover lives in `scripts/supabase-cutover/` (delete after cutover);
  `scripts/types/` holds the legacy Supabase TS types those scripts still import; `config-supabase.ts`
  is the shared Supabase/GCS connection. Several tools still read Supabase and need porting post-cutover.

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
`/` (Mapbox globe of dictionaries) · `/about` · `/tutorials` · `/dictionaries` · `/account` ·
`/create-dictionary` · `/[dictionaryId]/*` (entries list, entry detail, settings, about,
contributors, grammar, history, export, import, invite) · `/admin/*` (local-first super-admin:
dashboard + ntfy onboarding, messages incl. unmatched→match + AI triage, users, team chat,
dictionaries, analytics, schema graph, sync, triage-examples, legal-review) · `/og` (share image) ·
`/terms` · `/privacy-policy` · `/setlocale`.

Inbound email is AI-triaged by `$lib/agent/*` (xAI Grok, env-gated on `XAI_API_KEY`; classifies →
auto-assigns/auto-resolves → drafts a reply). See `.knowledge/admin/ai-triage-pipeline.md`.

## Human/agent editing parity (a direction we're walking toward)
The agent-facing `/api/v1` write API (per-dict API keys, `openapi.json`, `$lib/db/server/v1-*`) and
the human editing UI should reach **full feature parity** — anything a human can edit, an agent can
edit, and vice-versa, ideally through the same validated server helpers. We don't need it all at
once; when adding an editing feature, add (or plan) both surfaces and prefer routing them through one
shared server module (e.g. orthographies: `$lib/db/server/orthographies.ts` backs both the v1
endpoints and the settings-page catalog write).


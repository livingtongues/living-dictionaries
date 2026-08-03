---
include: [WEB.md]
---

# Living Dictionaries Architecture - dev runs on port 3041

A language-documentation web app served at `livingdictionaries.app` for communities to build a dictionary of **entries** (words/phrases), **sentences**, and **texts** that can have audio, photos, and video. 

The app runs on SQLite + a VPS. It's committed on and deployed from **`main`** — a push to `main` triggers the VPS deploy webhook.

### Additional tech stack

- **Media:** ALL media bytes (audio/video/photos) live on **R2** (`livingdictionaries-media`, public via `media.livingdictionaries.app`; keys `{dict}/{audio|video|photo}/{row_uuid}.{ext}`). Audio/video upload via presigned PUT (`/api/upload`); audio originals stay canonical while a queued two-pass ffmpeg pipeline creates universal playback derivatives (`{uuid}_p1.mp3`, VBR V6/32 kHz mono, linear loudness gain, entry-only adaptive trim) with a post-upload ping + five-minute ledger backstop (`$lib/server/audio-derivative.ts`); playback falls back to the original until the derivative exists. Photos POST bytes to `/api/photo-upload`, which stores the original, responds, then generates 3 WebP variants (`_thumb/_w900/_w1600.webp`, `$lib/server/photo-variants.ts`) in-process. Site-owned images use immutable `site/{asset}/{content_hash}/…` keys. Byte sizes live in the server-only shared.db `media_objects` ledger + `media_storage_daily` rollup (feeds `/admin/storage` — never lists R2 per page view); `$lib/db/server/media-sweep-cron.ts` reconciles weekly against a full R2 listing and REALLY deletes orphans past 30d grace (safe: the 1-year-locked `livingdictionaries-backups/media/` mirror). In dev there's no bucket: uploads and derivatives are served from a local `/api/dev-media` store. See `.knowledge/domain/media-serving-urls.md`.
- **Search**: local **Orama** index built from the wa-sqlite DB.
- **Telemetry:** browser + server logs POST to `/api/log` → `client_logs`, which since 2026-07-05 lives in its own server-only **`logs.db`** (`src/lib/db/server/logs-db.ts`, split out of shared.db at boot; aged rows → `logs-archive.db`). The forever rollups `log_daily_metrics` + `log_daily_sessions` + `dictionary_daily_views` (per-dict daily distinct-session counts) + `dictionary_monthly_visitors` (TRUE monthly-unique visitors — a whole-month UNION of cookieless `visitor_id`s per dict AND a site-wide `__site__` scope, recomputed from raw each sweep then frozen so it outlives the 60d prune; feeds the "Top dictionaries by unique visitors" panel + the future public "visitors/month" badge) stay in `shared.db`, never pruned. **`/admin/analytics` + `/admin/health` run ZERO queries** (2026-07-30): they read a daily JSON CHECKPOINT from `${DATA_DIR}/analytics/<days>-<audience>.json`, written by a `nice -n 19` CHILD PROCESS the daily (03:30 PT) retention cron forks (`src/lib/db/server/analytics-snapshot.ts` — same shape in house + tutor). `get_log_analytics` (3-tier: shared.db rollups ≤ the retention watermark, live `logs.db` scans for the tail) now runs ONLY in that child, once a day per audience, and must never be called from a route — it measured 11–80 s of blocked event loop when it did. Neither raw-log file is backed up — see the **check-logs** skill. **Both error hooks report** (2026-08-01): `hooks.server.ts`'s `handleError` writes a `crash` row stamped with a short `error_id` that also travels to the browser as `App.Error.error_id`, and `hooks.client.ts` logs `client_error: …` for anything SvelteKit catches in its own browser-side load/render path — so `+error.svelte`'s crash row carries `origin: 'server' | 'client'` and either the joining `error_id` or the real cause. Until then a browser-raised 500 was indistinguishable from an SSR one (see `.knowledge/server/sveltekit-error-hooks.md`). **`monthly_metrics` (2026-08-01)** — one FROZEN shared.db row per month of the numbers we actually report: reach, the mission (`public`+`unlisted`) vs fenced (`conlang`+`glossary`) split, and corpus production split **agent vs hand** (`changes.api_key_id` in each dict's `.history.db`: non-NULL = an `/api/v1` agent, NULL = a human in the UI). Computed in the SAME niced analytics child — its only write — because the raw logs behind it prune at 60d. Windows are explicit (`window_start`/`window_end`/`days_counted`) since `visitor_id` only shipped 2026-07-07: July measures 07-08→07-31 and normalizes FORWARD via `normalize_visitors()` (uniques are a UNION — never scale them linearly), every later month a no-op. The retention cron's after-sweep then posts a short summary into the admin chat `notifications` room (`monthly-metrics-announce.ts`, idempotent via `announced_at`).
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
`.issues/corpus-ga-graduation.md`] — entry detail, sentence detail, `texts` browse +
`texts/new` paste-to-sentences ingest + `text/[id]` reader [same admin-3 preview, route-guarded
via `$lib/corpus/corpus-preview-guard.ts` — lift at GA; M3 word→entry matching is live: sentences
auto-tokenize+match on ingest, token-tap popovers (confirm/link/create/ignore, `$lib/corpus/`),
review-mode toolbar, entry-page "Used in N sentences" concordance; M4 adds the `suggestions`
review queue (unmatched/ambiguous/ignored facets, form-wide link/create/ignore backed by the
syncable `ignored_forms` dict.db table the matcher consults, bulk ignore) + v1 parity
(`…/suggestions(/actions)`, `…/sentences/{id}/tokens/actions` via
`$lib/db/server/v1-suggestions.ts`); M5 audio: text/sentence audio attach (`$lib/media/
AttachAudioModal`, `add_audio` owners entry|sentence|text), karaoke playback (reader + sentence
page) and the waveform "Adjust timings" editor (`$lib/media/TimingsEditor` — sentence-scoped
zoom, draggable per-token region edges, re-encodes the chained `audio.timings` strings; timings
DATA comes from forced alignment or the v1 API — tap-along manual timing is dead); M6
forced-alignment: manager-only "Auto-align" button (reader + sentence page) fires a
fire-and-forget server job (`$lib/db/server/align/`, server-only shared.db `align_jobs` ledger +
rate limits) that romanizes each token per the admin-only `dictionaries.align_config` (`ascii_distill`
NFD cascade token_text→lexeme-orthography→phonetic + a bespoke per-dict `converters.ts` registry),
runs the MMS_FA aligner (`MODAL_ALIGN_URL` → LD-owned Modal app `ld-forced-aligner` in the top-level
`alignment/` uv package in prod; local CPU subprocess of that same package in dev), and writes
`audio.timings`; v1 parity `POST …/audio/{audioId}/align` + `GET …/align-jobs/{id}`; per-dict
`auto_align` graduation flag aligns automatically on attach, `.knowledge/domain/forced-alignment.md`)] —
settings (public/print
toggles + delete + a dialects manager [manager: rename / map areal-extent geometry via
GeoTaggingModal / delete]; catalog fields moved to home), about,
contributors, grammar, history, export, import [manager-only, agent-driven: upload ANY-format resources → per-file instructions →
"request import" opens an **import conversation** — a `message_threads` row with
`thread_kind='import'`, deliberately EXCLUDED from /admin/messages, worked by BOTH sides at
`/{dict}/import/{threadId}` (messages, the report artifact rendered in a sandboxed
script-blocked iframe, and answerable questions). `started_at` is the whole freeze rule:
before it the uploader may edit or withdraw, after it the resources are permanent dictionary
history. Nothing is ever hidden — resolved requests stay under "Past imports" forever.
Server-only tables `thread_participants` / `thread_artifacts` / `thread_questions`; files in
`source_files` + private R2 `import/{dict}/{file}`; one endpoint set
`/api/v1/dictionaries/{id}/conversations/*` serves managers, admins, and agents alike. Notify:
manager → chat-style email with a deep link (a stray inbox reply auto-threads back); assignee →
direct ping; every other admin → one Notifications-room notice per unread batch, rolled into the
8am digest. The agent kickoff runbook is DERIVED on demand (`…/conversations/{id}/brief`), never
stored — there are no internal notes. See `.knowledge/domain/import-workflow.md`], invite) · `/chat` (standalone membership-based
chat — DB-managed channels + DMs for admins, super managers, and partners; server-authoritative
via `/api/chat/*` polling, gate = admin OR a `users.chat_access` grant (toggled on /admin/users/[id]) OR member of ≥1 room — one circle, any chat member can DM any other; `admin_room` channels manageable only by
super admins) · `/translate` (standalone translator backend — server-authoritative via
`/api/translate/*`, gate = ≥1 `translator_languages` row or admin) · `/admin/*` (local-first super-admin: dashboard + ntfy onboarding, messages incl.
unmatched→match + AI triage, users, dictionaries [paginated table w/ serve/tolerate/delete bucket
triage via `dictionaries.bucket`; `bucket='secure'` is ENFORCED — direct-role holders + level-3
admins only, everyone else sees the unknown-slug redirect/404, no public R2 snapshot; rule lives
in `$lib/db/server/secure-dictionary.ts` + `verify_auth_dict_role`], analytics, schema graph,
sync, imports [cross-dictionary index of import conversations — the only place open ones are visible, since they never hit the inbox; sortable table, resolved sink to a "Past imports" group, status + "waiting on" derived in `$lib/import/import-status.ts`], triage-examples, legal-review, featured-words) · `/og` (share image) · `/terms` ·
`/privacy-policy` · `/setlocale`.

Inbound email is AI-triaged by `$lib/agent/*` (xAI Grok, env-gated on `XAI_API_KEY`; classifies →
auto-assigns/auto-resolves → drafts a reply); mail addressed to an admin's own alias (jacob@…)
skips triage and deterministically assigns to that admin. See `.knowledge/admin/ai-triage-pipeline.md`.
**Agent onboarding is a funnel, not a spec dump** — `GET /api/v1` is THE front door
(`$lib/api/v1/front-door.ts`, content-negotiated JSON/HTML from one object; an optional API key adds
the dictionary + a `suggested_task`). It routes to a task **guide** (markdown in
`$lib/api/v1/guides/`, served at `/api/v1/guides`) — guides are the primary doc layer, carrying the
judgement calls. `openapi.json` is the appendix and defaults to a compact index (`?tag=` for one
group, `?view=full` for all ~200KB). /admin/api-docs mirrors those hops as a route tree
(front door → guides/[slug] → reference/[tag] → schemas), each page loading the live endpoint it
mirrors. Keep the Agents-page prompt (`AgentPrompt.svelte`) pointed at `/api/v1`, never the spec.

## The reload-once rule (portfolio-wide, approved 2026-07-31)

**When the missing thing is a build artifact the server has DELETED, retrying is provably useless —
reload ONCE onto the current build instead of retrying N times.** `/_app/immutable/*` is
content-hashed, so a 404 there is permanent for this bundle; only the current build can help. It cost
a signed-in contributor a six-minute lockout from her own private dictionary on 2026-07-29 (39
`leader_boot_failed` + 14 `dict_boot_recovery_exhausted` chasing a chunk a deploy had removed).

Implemented for the dict leader-worker boot: classifier `$lib/db/client/stale-build-artifact.ts`
(injected into the app-agnostic `worker/db-client.ts` as `boot_failure_terminal_reason`, never
hard-coded there — that folder is copy-paste-shared with house) → recovery
`$lib/db/dict-client/stale-bundle-recovery.ts`. Every outcome emits exactly one terminal row
(`stale_bundle_reload` / `_deferred` / `_gave_up`) so the rule stays measurable. Apply the same shape
to any NEW retry loop over a build artifact. Deliberately narrower than the declined zombie-tab
forced reload: foreground tabs only, once per guard window, then a toast. **It lives in the DATA
layer, NOT in `hooks.client.ts`** (where house puts its equivalent) — never add a second one there;
the client error hook only *labels* a stale-build fault.

## Human/agent editing parity (a direction we're walking toward)
The agent-facing `/api/v1` write API (per-dict API keys, `openapi.json`, `$lib/db/server/v1-*`) and
the human editing UI should reach **full feature parity** — anything a human can edit, an agent can
edit, and vice-versa, ideally through the same validated server helpers. We don't need it all at
once; when adding an editing feature, add (or plan) both surfaces and prefer routing them through one
shared server module (e.g. orthographies: `$lib/db/server/orthographies.ts` backs both the v1
endpoints and the dictionary-home catalog write).

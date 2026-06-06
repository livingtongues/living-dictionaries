# Living Dictionaries

Living Dictionaries is a language-documentation web app: communities build a **dictionary** of
**entries** (words/phrases), each with **senses**, example **sentences**, and rich media (audio,
photos, video) tied to **speakers**, plus **dialects** and **tags**. Public read-only browsing for
anyone; managers/editors/contributors edit a given dictionary; super-admins get an **`/admin`**
surface. It runs on the **VPS + SQLite + Svelte 5** stack shared with **house** and **tutor**.

The app is feature-complete on this stack and committed on the **`svelte-5-migration`** branch; the
one remaining milestone is the **VPS deploy cutover**. For deploy state, the deploy mechanism, and
the durable conventions shared with house, read **`.issues/cross-project-orchestration.md`** — it's
the master plan. Everything below is the always-true context around it.

## Branch & repos
- **`~/code/living-dictionaries`** (this repo) — the live app. Working/deploy branch is
  **`svelte-5-migration`**: it's what's checked out and what the VPS deploy webhook fires on.
- **`~/code/living-dictionaries-example`** — an earlier finished "all-at-once" port, kept
  **read-only** as a parts-bin. Peek across the fence for patterns / copy self-contained modules;
  never bulk-import its infrastructure. Its own `AGENTS.md`/skills describe that repo's end state
  and can be wrong for here.
- **house** (`~/code/house`) is the parallel app on the same wa-sqlite/JWT/SQLite substrate; the
  shared conventions are the contract between them (see the orchestration issue).

## Stack
- **Frontend:** SvelteKit + **Svelte 5 / runes**. **UnoCSS** via the universal `unocss/vite` plugin
  (`extractorSvelte()` + `transformerDirectives()`) — never reintroduce `@unocss/svelte-scoped`,
  don't go plain-CSS. Icons: Iconify `class="i-collection-name"` **and** `unplugin-icons` `~icons/*`
  (used by `/admin`).
- **Adapter:** `@sveltejs/adapter-node` — `pnpm build` → `node build`. Native runtime deps
  (`better-sqlite3`, …) MUST live in `dependencies` (adapter-node externalizes `dependencies`,
  bundles `devDependencies`).
- **Data:** real **SQLite**. Server (better-sqlite3): `shared.db` (global catalog / users / roles /
  client logs) + per-dict `dictionaries/{id}.db` (content), under `.data/` (`DATA_DIR`). Browser:
  **wa-sqlite** + SharedWorker with bidirectional `/changes` sync; **Orama** full-text search fed by
  watching wa-sqlite. UI reads/writes live reactive rows. See the `database` skill.
- **Auth:** real **Email-OTP + JWT** (jose) + Google one-tap. Per-dict permissions are **NUMERIC**
  (`AdminLevel`; dev `dev_admin_level` cookie). The named-roles migration was designed and
  **rejected** by Jacob — don't re-propose. In dev, `send-code` returns the OTP inline (no inbox).
- **Media:** bytes live on legacy **GCS** (presigned PUT upload; serving URLs built in
  `src/lib/helpers/media-url.ts` from `PUBLIC_STORAGE_BUCKET`) — there is **no media→R2 migration**.
  Photos use App Engine Images `lh3` serving URLs (see `.knowledge/domain/media-serving-urls.md`).
  In dev there's no GCS bucket: uploads are served from a local `/api/dev-media` store, while pulled
  photos still hit the public lh3 CDN.
- **R2:** DB **snapshots** (built by `src/lib/db/server/r2-snapshot-builder.ts`, restored via
  `src/lib/db/dict-client/fetch-snapshot.ts`) + admin **message attachments** (`src/lib/r2/*`).
  R2 vars are `$env/dynamic/private` (runtime, not preflight-gated).
- **Email:** **out** via **mimetext** + AWS **SES** (`src/lib/email/*`). **In** via the `cf-worker/`
  Cloudflare Email Routing worker (`ld-email`): parses inbound MIME, puts attachments in R2, POSTs
  metadata to `/api/messages/email-inbound`. nodemailer is gone.
- **i18n:** EN strings in `site/src/lib/i18n/locales/en.json`; other languages are filled by human
  translators (regenerated from `scripts/locales/` via `pnpm --filter scripts update-locales`) — add
  keys to `en.json` only. In components, match the pattern of neighboring files.
- **Testing:** Vitest (unit + in-source `import.meta.vitest`). Component visual checks via svelte-look
  + Playwright. Headless deep-flow e2e via puppeteer-core.

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
schema graph, users, dictionaries, messages, sync) · `/og` (share image) · `/terms` · `/setlocale`.

## Project structure
- `site/` — the SvelteKit app; the only workspace package (`pnpm-workspace.yaml`). `$lib` =
  `src/lib`, `$api` = `src/routes/api`. Shared TS types live in `src/lib/types` (Drizzle-derived).
- `scripts/` — standalone data/migration tooling (its own lockfile; NOT a workspace member — install
  with `pnpm install --ignore-workspace`, else pnpm installs the root workspace instead). The
  Supabase→SQLite cutover lives in `scripts/supabase-cutover/` (delete after cutover);
  `scripts/types/` holds the legacy Supabase TS types those scripts still import; `config-supabase.ts`
  is the shared Supabase/GCS connection. Several tools still read Supabase and need porting post-cutover.
- `cf-worker/` — the `ld-email` inbound Cloudflare Email Routing worker (separate deploy).
- `ids-import/`, `python-scripts/` — import tooling (excluded from the pnpm install).
- `archive/` — parked legacy code (api-keys, history, …): reference only, not built.
- `.data/` — local SQLite DBs (`shared.db` + per-dict). Root `Dockerfile` / `docker-compose.yml` /
  `.dockerignore` drive the VPS deploy.

## Conventions
- snake_case for vars/functions; lowercase-hyphen filenames; options-object args (no positional
  multi-arg, no bare-boolean args); no `!` non-null assertions; **not** strict TS; few comments.
- Use constants from `src/lib/constants.ts`, not magic strings.
- New English i18n keys → `en.json` only.
- **SQL keywords ALLCAPS.**
- **Sync-engine invariants** (don't relearn): clear `dirty` ONLY by pushed row id (not blanket
  `WHERE dirty=1` — junctions silently never sync); `db_metadata` triggers use `ON CONFLICT DO
  UPDATE` (not `INSERT OR REPLACE`); `/changes` fast-bail must not drop pushes when
  `cursor==watermark`; `ensure_initial_sync()` before writes.
- **Lockfile fidelity:** structural changes must honor the committed `pnpm-lock.yaml` — never let a
  plain `pnpm install` drift versions. See `.knowledge/migration/build-and-deploy-gotchas.md`.

## Verify your work (from repo root)
- `pnpm --filter=site check` → must be **0 errors** (don't add new warnings).
- `pnpm --filter=site test --run` → green.
- `pnpm --filter=site build`, then `cd site && node build` boots (`Listening on …`).
  **`node build` localhost HTTP IS curl-able from the sandbox** — use it to catch SSR-render 500s the
  static gates miss (e.g. `PORT=3073 node build &` then
  `curl --retry … --retry-connrefused http://localhost:3073/…`).
- `pnpm lint` / `pnpm lint:fix` on changed files.
- **Dev server `http://localhost:3041` — Jacob runs it, never start it.** Logs at
  `site/.dev-server.log`. The agent's headless Chrome has no real WebGL → Mapbox tiles need Jacob's
  eyeball; `curl` to `:3041` returns 000 (no sandbox network to the dev server). Query the live
  browser DBs via the `sqlite-query` skill (LD proxy on ports 4050/4051).

## Where to look
| Need | Where |
|---|---|
| The plan / deploy state / deploy mechanism | `.issues/cross-project-orchestration.md` |
| SQLite / sync / live reactive data | `.claude/skills/database/SKILL.md` |
| API endpoints (`_call.ts` pattern) | `.claude/skills/api-endpoint/SKILL.md` |
| Query the live browser DBs | `.claude/skills/sqlite-query/SKILL.md` |
| Svelte 5 / SvelteKit help | `.claude/skills/svelte/SKILL.md` |
| Component screenshots | `.claude/skills/svelte-look/SKILL.md` |
| Build/deploy gotchas, lockfile rule | `.knowledge/migration/build-and-deploy-gotchas.md` |
| Durable migration gotchas (runes, sqlite, auth, media, sync) | `.knowledge/migration/*` |
| App-domain knowledge (media URLs, related entries, import) | `.knowledge/domain/*` |

## Skills & commands (live now)
- **Skills:** `database`, `api-endpoint`, `sqlite-query`, `svelte`, `svelte-look`.
- **Commands (need the deployed VPS):** `debug-vps`, `prod-db`, `backup-vps-db`, `scan-and-fix-errors`.

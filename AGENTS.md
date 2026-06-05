# Living Dictionaries

Living Dictionaries is a language-documentation web app (dictionaries → entries → senses →
media). This repo is the **live production app**, rebuilt off Vercel+Supabase onto the
VPS+SQLite+Svelte-5 stack that house+tutor use. **The migration is done except deployment** —
what remains is the M3 VPS cutover plus live eyeballs.

> **Read `.issues/cross-project-orchestration.md` first.** It is the master plan: current state,
> the durable conventions shared with house, the deploy mechanism, and the remaining work.
> Everything below is the always-true context around it.

> **One writer per tree.** Several agent sessions run in this repo at once — never run two
> *writing* agents in the same working tree. Serialize same-repo work. Commit on the branch,
> **never push** (Jacob controls deploy pushes).

## Branch & repos
- **`~/code/living-dictionaries`** (this repo) — the live app. Working/deploy branch is
  **`svelte-5-migration`**: it's what's checked out and what the VPS deploy webhook fires on.
  (The master plan's older `vps-migration` references are the same line of work — the deploy
  branch was kept as `svelte-5-migration` rather than flipped.)
- **`~/code/living-dictionaries-example`** — an earlier finished "all-at-once" port, kept
  **read-only** as a parts-bin. Peek across the fence for patterns / copy self-contained
  modules; never bulk-import its infrastructure. Its own `AGENTS.md`/skills describe the end
  state and can be wrong for here.

## What's true right now (stack)
- **Frontend:** SvelteKit + **Svelte 5 / runes**. **UnoCSS** via the universal `unocss/vite`
  plugin (`extractorSvelte()` + `transformerDirectives()`) — never reintroduce
  `@unocss/svelte-scoped`, don't go plain-CSS. Icons: Iconify `class="i-collection-name"`
  **and** `unplugin-icons` `~icons/*` (used by the ported `/admin` section).
- **Adapter:** `@sveltejs/adapter-node` — `pnpm build` → `node build`. Native runtime deps
  (`better-sqlite3`, …) MUST live in `dependencies` (adapter-node externalizes `dependencies`,
  bundles `devDependencies`).
- **Data:** real **SQLite**. Server (better-sqlite3): `shared.db` (global catalog / users /
  roles / client logs) + per-dict `dictionaries/{id}.db` (content), under `.data/` (`DATA_DIR`).
  Browser: **wa-sqlite** + SharedWorker with bidirectional `/changes` sync; **Orama** search
  fed by watching wa-sqlite. See the `database` skill.
- **Auth:** real **Email-OTP + JWT** (jose) + Google one-tap. Per-dict permissions are
  **NUMERIC** (`AdminLevel`; dev `dev_admin_level` cookie). The named-roles migration was
  designed and **rejected** by Jacob — don't re-propose.
- **Media:** legacy **GCS** presigned PUT (no media→R2 migration). **R2** is for DB
  **snapshots** + admin **message attachments** only (`src/lib/r2/*`).
- **Email:** **mimetext** + AWS **SES** (`src/lib/email/send-raw-email.ts`). nodemailer is gone.
- **i18n:** EN strings in `site/src/lib/i18n/locales/en.json`. Don't add other languages (human
  translators do). In components, match the pattern of neighboring files.
- **Testing:** Vitest (unit + in-source `import.meta.vitest`). Component visual checks via
  svelte-look + Playwright.
- **Supabase:** fully removed — no `@supabase/*` imports, no `supabase/` dir.

## Project structure
- `site/` — the SvelteKit app; the only workspace package (`pnpm-workspace.yaml`). `$lib` =
  `src/lib`, `$api` = `src/routes/api`.
- `types/` — shared TS types (`@living-dictionaries/types`), hand-maintained interfaces (no
  longer Supabase-generated).
- `scripts/` — data/migration scripts (Supabase→SQLite import, refactors, spreadsheet helpers).
- `ids-import/`, `python-scripts/` — import tooling (excluded from the pnpm install).
- `archive/` — parked legacy code (api-keys, history, …): reference only, not built.
- `.data/` — local SQLite DBs (`shared.db` + per-dict). Root `Dockerfile` / `docker-compose.yml`
  / `.dockerignore` drive the M3 VPS deploy.

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
- **Lockfile fidelity:** structural changes must honor the committed `pnpm-lock.yaml` — never
  let a plain `pnpm install` drift versions. See `.knowledge/migration/build-and-deploy-gotchas.md`.

## Verify your work (from repo root)
- `pnpm --filter=site check` → must be **0 errors** (don't add new warnings).
- `pnpm --filter=site test --run` → green.
- `pnpm --filter=site build`, then `cd site && node build` boots (`Listening on …`).
  **`node build` localhost HTTP IS curl-able from the sandbox** — use it to catch SSR-render
  500s the static gates miss (e.g. `PORT=3073 node build &` then
  `curl --retry … --retry-connrefused http://localhost:3073/…`).
- `pnpm lint` / `pnpm lint:fix` on changed files.
- **Dev server `http://localhost:3041` — Jacob runs it, never start it.** Logs at
  `site/.dev-server.log`. The agent's headless Chrome has no real WebGL → Mapbox tiles need
  Jacob's eyeball; `curl` to `:3041` returns 000 (no sandbox network to the dev server).

## Where to look
| Need | Where |
|---|---|
| The plan / next step / deploy mechanism | `.issues/cross-project-orchestration.md` |
| App domain + data model | `.claude/skills/learn-about-app/SKILL.md` |
| SQLite / sync / live reactive data | `.claude/skills/database/SKILL.md` |
| API endpoints (`_call.ts` pattern) | `.claude/skills/api-endpoint/SKILL.md` |
| Svelte 5 / SvelteKit help | `.claude/skills/svelte/SKILL.md` |
| Component screenshots | `.claude/skills/svelte-look/SKILL.md` |
| Build/deploy gotchas, lockfile rule | `.knowledge/migration/build-and-deploy-gotchas.md` |
| Durable migration gotchas (runes, sqlite, auth, media, sync) | `.knowledge/migration/*` |

## Skills & commands (live now)
- **Skills:** `learn-about-app`, `database`, `api-endpoint`, `svelte`, `svelte-look`.
- **Commands (need the deployed VPS):** `debug-vps`, `prod-db`, `backup-vps-db`, `scan-and-fix-errors`.

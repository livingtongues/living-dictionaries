# Living Dictionaries — agent guide (vps-migration branch)

Living Dictionaries is a language-documentation web app (dictionaries → entries → senses →
media). This repo is the **live production app** being evolved, in small verifiable steps,
off Vercel+Supabase and onto the VPS+SQLite stack the sibling apps (house/tutor) use.

> **Read `.issues/vps-migration.md` first.** It is the master plan: the milestone ladder,
> what's done, and the next step. Everything below is the always-true context around it.

## Two repos (important)
- **`~/code/living-dictionaries`** (this repo) — the one we **improve**. Branch `vps-migration`.
- **`~/code/living-dictionaries-example`** — the one we **learn from**. The previous
  all-at-once attempt (`svelte-5-migration`): a finished but "too-big-a-jump" port to the
  target stack. **Peek across the fence** for patterns and copy self-contained modules — but
  we are NOT bulk-importing it. Its own `AGENTS.md`/skills describe the END state and are
  often wrong for where we are now.

## The migration in one paragraph
Today the app is **SvelteKit + Svelte 4 + UnoCSS + Supabase** (Postgres data + auth),
formerly deployed to Vercel. We are: (M1) stubbing auth + db to cut Supabase out so it boots
with zero Supabase, (M2) converting to Svelte 5 component-by-component on the inert stub (the
centerpiece; site looks identical), (M3) deploying the stubbed app to the VPS via Docker, then
(M4+) reintroducing real systems one at a time — SQLite read → write/sync → real auth → media
→ R2 snapshots. **We never run Supabase Docker.** Don't take big leaps; one reversible thing
at a time, app runnable at every step.

## Project structure
- `site/` — the SvelteKit app (top-level, moved from `packages/site` in M0). `$lib` = `src/lib`, `$api` = `src/routes/api`.
- `packages/types` — shared TS types (`@living-dictionaries/types`); still Supabase-generated for now.
- `packages/scripts` — data/migration scripts.
- `packages/ids-import`, `packages/python-scripts` — import tooling (excluded from the pnpm workspace install).
- `supabase/` — legacy Supabase config/migrations (reference during migration; not run locally).

## Current stack (what's true right now)
- **Frontend:** SvelteKit, **Svelte 4** (→ Svelte 5 in M2). **UnoCSS** (Tailwind-syntax) with
  Iconify icons as `<span class="i-collection-name">`. In M2a the UnoCSS *plugin* switches from
  `@unocss/svelte-scoped` to the universal `unocss/vite` (Svelte-5 compat) — **classes don't change.**
- **Adapter:** `@sveltejs/adapter-node` (swapped from adapter-vercel in M0.5; `pnpm build` → `node build`).
- **Data/auth:** Supabase (`src/lib/supabase/*`, `cached-data.ts`) — **being stubbed out in M1.**
  After M1, auth is a hand-wave dev user and data is a tiny dummy set in the existing shapes.
- **i18n:** EN strings in `site/src/lib/i18n/locales/en.json`. Don't add other languages (human
  translators do). In components, the existing pattern (Svelte 4) — match what neighboring files do.
- **Testing:** Vitest. Component visual regression via Kitbook + Playwright (existing infra).

## Conventions
- snake_case for vars/functions; lowercase-hyphen filenames; options-object args (no positional
  multi-arg, no bare-boolean args); no `!` non-null assertions; **not** strict TS; few comments.
- Use constants from `src/lib/constants.ts`, not magic strings.
- New English i18n keys → `en.json` only.
- SQL keywords ALLCAPS (relevant once SQLite lands in M4).
- **Lockfile fidelity:** structural changes must honor the committed `pnpm-lock.yaml` — never
  let a plain `pnpm install` drift versions. See `.knowledge/migration/build-and-deploy-gotchas.md`.

## Verify your work (from repo root)
- `pnpm --filter=site check` → must be **0 errors** (62 warnings is the current baseline).
- `pnpm --filter=site test --run` → green.
- `pnpm --filter=site build` → adapter-node output; `cd site && node build` boots (`Listening on …`).
- `pnpm lint` / `pnpm lint:fix` on changed files.
- **Dev server:** `http://localhost:3041` — **Jacob runs it, never start it.** Logs at `site/.dev-server.log`.
- The agent's headless Chrome has no real WebGL → can't verify Mapbox tiles; `curl` to `:3041`
  returns 000 (no sandbox network). Jacob eyeballs live UI / maps.

## Where to look
| Need | Where |
|---|---|
| The plan / next step | `.issues/vps-migration.md` |
| App domain + data model | `.claude/skills/learn-about-app/SKILL.md` |
| Svelte 5 / SvelteKit help | `.claude/skills/svelte/SKILL.md` |
| Build/deploy gotchas, lockfile rule | `.knowledge/migration/build-and-deploy-gotchas.md` |
| Target architecture (SQLite/sync/VPS) | the example repo's `.knowledge/architecture/*` (reference) |

## Skills/commands not yet brought over (come online with their milestone)
- `database`, `api-endpoint` skills — target-stack conventions (SQLite LiveDb, `_call.ts`); arrive ~M4.
- `svelte-ui` skill — plain-CSS/theme conventions + svelte-look; not relevant while we're on UnoCSS.
- `debug-vps`, `prod-db`, `backup-vps-db`, `scan-and-fix-errors` commands — need the deployed VPS; arrive ~M3.

# Cross-project orchestration — what's LEFT (consolidated 2026-06-05)

Orchestrates the parallel modernization of **living-dictionaries** (`vps-migration` branch) and
**house** (`repo-restructure` branch): both took Svelte-4 apps off a hosted backend (Supabase / Firebase)
onto our own SQLite, bumped to Svelte 5 + latest Vite/UnoCSS, and verify with puppeteer-core. This file
is the **single orchestration index** — only remaining work + durable decisions. (The long play-by-play
of completed milestones was pruned; durable learnings live in each repo's `.knowledge/`.)

## Status — both apps are essentially migrated ✅
- **LD** (`vps-migration`): Svelte 5/runes, lint clean, real SQLite read + write/sync (wa-sqlite + sync
  engine), real auth (OTP/JWT/Google + per-dict roles), media upload (legacy GCS), and the full admin
  port. Docker deploy prep built + verified locally. **Tree committed (3 per-concern commits on
  `vps-migration`, unpushed, 2026-06-05); not yet deployed — M3 cutover next.**
- **house** (`repo-restructure`): auth + customer reader + admin (local-first wa-sqlite sync) + library
  editing all off Firestore. **DEPLOYED LIVE on `new.hvsb.app`** (staging; via vps-setup webhook). Local
  search Phase 0 (admin Orama) done.

## ⚠️ Hard-won orchestration conventions (don't relearn these)
- **Same-repo serialization — never run two WRITING agents in one working tree.** We got burned: BOTH
  trees got tangled by concurrent agents (LD: admin-port + deploy WIP intermingled; house: deploy +
  search + auth/privacy WIP). Untangling-by-path at commit time is the cost. One writer per tree.
- A child session **cannot reply into this human-facing orchestrator session** (`horse send` only
  delivers to Horse-run sessions). Use the **file handoff** (this issue) + Jacob relays "done".
- Spawn with `horse spawn <project>`; the `~/.claude/skills/horse-cli/SKILL.md` is current (`spawn`=new,
  `send`=message existing, `tail`=follow).
- Each session: PLAN + interview Jacob before mass edits on big tasks; verify with the shared headless
  launcher (`import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'`),
  asserting `page.on('pageerror')` empty; commit on the feature branch, **don't push** (Jacob controls
  deploy pushes); Jacob eyeballs live UI/maps (LD :3041, house :5000 — agents can't do WebGL/maps).

## Durable cross-project decisions (carry forward)
- **Keep UnoCSS, global plugin** (`unocss/vite` + `extractorSvelte()` + `transformerDirectives()`) — never
  reintroduce `@unocss/svelte-scoped`; don't go plain-CSS in these two.
- **Vendor svelte-pieces** into each repo (Svelte 5). **Latest toolchain** matched: Vite 8 / vps7 /
  svelte 5.56 / kit 2.62 / vitest 4 / ts 5.9 / unocss 66. **adapter-node**; native deps (better-sqlite3,
  etc.) MUST be in `dependencies` (adapter-node externalizes deps / bundles devDeps).
- **Auth = Email-OTP + JWT + SQLite users + allow-lists.** **Permissions stay NUMERIC** — the named-roles
  migration was designed and **REJECTED** (Jacob); don't re-propose. (LD: `AdminLevel` + `dev_admin_level`
  cookie; house: `level` 1/2/3 + `is_editor`.)
- **wa-sqlite local-first sync engine** (browser DB + SharedWorker + bidirectional `/changes` sync) is the
  shared write/sync substrate in both. **Sync-engine gotchas to keep:** clear `dirty` ONLY by pushed row
  id (NOT a blanket `WHERE dirty=1` — junctions silently never sync); `db_metadata` triggers must use
  `ON CONFLICT DO UPDATE` (not `INSERT OR REPLACE`, which 500s under an upsert); `/changes` fast-bail must
  not drop pushes when cursor==watermark; `ensure_initial_sync()` before writes; a local `users` row for
  FKs; sector-scoped `deletes`.
- **Runes gotchas:** `bind:value` to a `$derived` silently no-ops; `$state` bound to a child's
  non-undefined `$bindable(x)` fallback throws `props_invalid_value` at mount.
- **⛔ R2 is OUT this month** — media bytes stay on legacy GCS (LD) / Firebase Storage (house); no R2
  snapshot builder / image migration. (R2 *attachments* for house admin messages are kept — separate.)
- **Deploy = vps-setup GitHub webhook**, NOT GitHub Actions: webhook → VPS `deploy.sh` (from
  `~/code/vps-setup/bin/sync <app>`) → `docker compose build` root `Dockerfile` → restart. `<app>.conf`
  holds `DEPLOY_BRANCH`. house live on `new.hvsb.app`; LD target `new.livingdictionaries.app`.

## REMAINING WORK

### living-dictionaries
1. **✅ DONE — untangled + committed the LD tree (2026-06-05).** Three per-concern commits on
   `vps-migration`, **not pushed** (Jacob controls deploy pushes), full gate green before committing
   (check 0/18 · test 327 · build boots):
   - `1e490fd2` **admin-port** (130 files): client admin sync engine, schema viewer (xyflow/dagre),
     users/dictionaries/messages/sync pages, messages infra (email/R2 attachments), deps + `~icons`
     plugin, scoped `.admin-root` theme, old Supabase-stub admin deleted. Plan: `.issues/admin-port.md`.
   - `9919df8f` **deploy prep** (M3): Dockerfile, docker-compose.yml, .dockerignore, root package.json
     (pin pnpm@10.33.0 + onlyBuiltDependencies), vite.config lazy-svelte-look, gitignore local env.
     Plan: `.issues/m3-deploy.md`.
   - housekeeping (this commit): README Svelte-5 badges, dev env (JWT_SECRET + Google OAuth client id),
     deleted stale issue files, `.claude/skills/{api-endpoint,database}` + commands.
   - **The only genuinely entangled file was `site/vite.config.ts`** (admin Icons hunk + deploy
     lazy-svelte-look async wrapper); split by hand-editing to the admin-only intermediate state for
     commit 1, then re-applying the async wrapper for commit 2. Lockfile was 100% admin deps
     (this pnpm setup doesn't record `onlyBuiltDependencies` in the lockfile).
2. **LD M3 deploy cutover (Jacob, collaborative) — NEXT** — full steps in `.issues/m3-deploy.md`:
   ensure `secrets-decrypted/sveltekit-living.env` has the static keys (`PUBLIC_mapboxAccessToken`,
   `PUBLIC_STORAGE_BUCKET`, `AWS_SES_*`) + dynamic (`JWT_SECRET`, `PUBLIC_GOOGLE_OAUTH_CLIENT_ID`,
   `GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID/_SECRET_ACCESS_KEY`, `PROCESS_IMAGE_URL`, `DATA_DIR=/data`) →
   `bin/secrets-encrypt` + `bin/sync living` → flip `living.conf` `DEPLOY_BRANCH svelte-5-migration →
   vps-migration` → `bin/sync living` → push `vps-migration` → verify `new.livingdictionaries.app`.
   **`.data` seeding deferred to cutover:** first boot self-migrates to an empty catalog; then `rsync`
   local `site/.data/` (~21 MB) → `living:/opt/hosting/data/`.
3. **LD admin-port follow-ups:** R2 env for message attachments (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_ATTACHMENTS_BUCKET`); optional `e2e/admin-flow.mjs` (dev-OTP admin deep
   flow); live `:3041` authenticated eyeball (OTP admin → wa-sqlite admin sync → graph → real reply);
   dict-delete R2-snapshot/orphaned-media cleanup still stubbed.

### house (Jacob-driven right now — orchestrator is tracking, not spawning, until handed back)
1. **Commit house's intermingled tree** (deploy-prep already committed+live; auth/subscribe/privacy/
   content-gating + search Phase 0 still uncommitted) — per-concern, explicit paths.
2. **Local search Phases 1–3** (`.issues/local-search.md`): R2 snapshot pipeline → viewer SharedWorker/
   OPFS DB → retire Algolia + port `SearchPage`/`/search`. Await the VPS. Phase 0 browser smoke test still
   pending a running `/site`.
3. **Queued LD→house audits (data-integrity, from LD-MEDIA):** verify house's wa-sqlite engine clears
   `dirty` by pushed id (not blanket); audit the two runes gotchas above. (See "Durable decisions".)
4. **house deploy follow-ups (Jacob):** `bin/secrets-encrypt` + commit `secrets/` (persist the 5 keys);
   VPS `shared.db` data-migration (less content than the local 64 MB copy).
5. **Deferred house niggles:** orphaned-media cleanup, translate editing, compose-new-email, stripe
   reconcile dep, content-gating/privacy (in flight). (`.issues/deferred-niggles.md`, `content-gating-and-privacy.md`.)
6. **Production DNS / Stripe-webhook cutover** (`.issues/port-customer-site-from-old.md`) — the far finale;
   `new.hvsb.app` is staging.

## Issue-file cleanup
- **LD — DELETED this pass** (done; durable learnings are in `.knowledge/migration/`): m2b, m2c,
  lint-unblock-and-legacy-runes, m4-real-auth, m4-sqlite-read, m4-write-sync, media-upload-and-sw-fix,
  puppeteer-deep-flow-test, service-worker-404, subagent-reports/. **Kept:** this file, `vps-migration.md`
  (LD master record, AGENTS-referenced), `m3-deploy.md` (deploy in progress), `admin-port.md` (in review).
- **house — to delete once its tree is free** (done): `svelte-5-migration.md`,
  `repo-restructure-chameleon.md`, `lint-clean-and-reenable-hook.md`, `sqlite-auth-foundation.md`,
  `sqlite-data-reads.md`, `sqlite-admin.md`, `library-editing-on-sqlite.md`, `sync-engine-bug-audit.md`,
  `deploy-prep-docker-vps.md`, `auth-login-ui-followups.md`, and the **stray `cross-project-orchestration.md`
  copy** (canonical lives here in LD). **Keep:** `local-search.md`, `content-gating-and-privacy.md`,
  `deferred-niggles.md`, `port-customer-site-from-old.md`, `customer-ticket-status-portal.md`,
  `eric-mailbox-and-support-routing.md`, `inbound-email-triage-agent.md`, `future/`.

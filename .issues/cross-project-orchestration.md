# LD master plan (VPS migration) + cross-project orchestration

The **single master issue** for finishing Living Dictionaries' move off Vercel+Supabase onto the
VPS+SQLite+Svelte-5 stack, and the index of durable conventions shared with **house** (its parallel
modernization). The migration itself is **done except deployment** — what remains is the M3 cutover
plus a short tail of follow-ups and live eyeballs.

## State in one paragraph
LD (`svelte-5-migration` branch) has been rebuilt in **Svelte 5 / runes** on real **SQLite** (server
better-sqlite3 `shared.db` catalog + per-dict `dictionaries/{id}.db`; browser **wa-sqlite** +
SharedWorker + bidirectional `/changes` sync; Orama search fed by watching wa-sqlite), with real
**auth** (Email-OTP / JWT / Google + per-dict **numeric** roles), legacy-**GCS** media upload
(presigned PUT), and a full local-first **`/admin`** (client admin sync engine, schema viewer with
xyflow/dagre, users / dictionaries / messages / sync pages; messages use **R2 attachments** + SES).
Docker deploy prep (root `Dockerfile`, `docker-compose.yml`, `.dockerignore`, pinned pnpm) is built
and verified locally. **Everything is committed on `svelte-5-migration` (unpushed); nothing is
deployed yet.** Per-milestone blow-by-blow has been pruned — durable gotchas live in `.knowledge/migration/*`.

## Two repos
| Repo | Role | Branch |
|---|---|---|
| `~/code/living-dictionaries` | **improve** (this repo) | `svelte-5-migration` |
| `~/code/living-dictionaries-example` | **learn from** (read-only parts-bin) | `svelte-5-migration` |

The example is the finished destination. We **peek across the fence** for patterns and copy
self-contained modules — never bulk-import its infrastructure.

---

## Durable conventions — don't relearn these

### Orchestration
- **One writer per tree, always.** Never run two *writing* agents in one working tree. We got
  burned twice (LD: admin-port + deploy WIP intermingled; house: deploy + search + auth WIP) and
  paid for it untangling-by-path at commit time. Serialize same-repo work.
- A child session **cannot reply into a human-facing orchestrator session** (`horse send` only
  delivers to Horse-run sessions). Use a **file handoff** (this issue) + Jacob relays "done".
- Spawn with `horse spawn <project>` (`~/.claude/skills/horse-cli/SKILL.md`: `spawn`=new,
  `send`=message existing, `tail`=follow).
- Each session: **PLAN + interview Jacob** before mass edits on big tasks; verify with the shared
  headless launcher (`import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'`,
  asserting `page.on('pageerror')` is empty); **commit on the feature branch, never push** (Jacob
  controls deploy pushes); Jacob eyeballs live UI/maps (LD :3041, house :5000 — agents can't do
  WebGL/maps; `curl` to :3041 returns 000 in the sandbox, but `node build` localhost HTTP works).

### Stack & architecture decisions (carry forward to both repos)
- **Keep UnoCSS, global plugin** (`unocss/vite` + `extractorSvelte()` + `transformerDirectives()`).
  Never reintroduce `@unocss/svelte-scoped`; don't go plain-CSS in LD/house.
- **Vendor svelte-pieces** into each repo (Svelte 5). **Latest toolchain** matched: Vite 8 / vps7 /
  svelte 5.56 / kit 2.62 / vitest 4 / ts 5.9 / unocss 66. **adapter-node**; native deps
  (`better-sqlite3`, etc.) MUST be in `dependencies` (adapter-node externalizes deps, bundles devDeps).
- **Auth = Email-OTP + JWT + SQLite users + allow-lists. Permissions stay NUMERIC** — the named-roles
  migration was designed and **REJECTED** (Jacob); don't re-propose. LD: `AdminLevel` + dev
  `dev_admin_level` cookie. house: `level` 1/2/3 + `is_editor`.
- **wa-sqlite local-first sync engine** (browser DB + SharedWorker + bidirectional `/changes` sync)
  is the shared write/sync substrate. **Sync-engine invariants to keep:** clear `dirty` ONLY by
  pushed row id (NOT blanket `WHERE dirty=1` — junctions silently never sync); `db_metadata`
  triggers use `ON CONFLICT DO UPDATE` (not `INSERT OR REPLACE`, which 500s under an upsert);
  `/changes` fast-bail must not drop pushes when `cursor==watermark`; `ensure_initial_sync()` before
  writes; a local `users` row for FKs; sector-scoped `deletes`.
- **Runes gotchas:** `bind:value` to a `$derived` silently no-ops; `$state` bound to a child's
  non-undefined `$bindable(x)` fallback throws `props_invalid_value` at mount.
- **R2 = DB snapshots + message attachments, NOT media bytes.** Media bytes stay on legacy **GCS**
  (LD: serving URLs built via `PUBLIC_STORAGE_BUCKET`, prod `talking-dictionaries-alpha.appspot.com`)
  / Firebase Storage (house) — no media→R2 migration. R2 IS used for DB **snapshots**
  (`R2_SNAPSHOTS_BUCKET`, `lib/r2/client.ts`) and message **attachments** (`R2_ATTACHMENTS_BUCKET`,
  `lib/r2/put-attachment.ts`). R2 vars are `$env/dynamic/private` (runtime, NOT preflight-gated).
- **Deploy = vps-setup GitHub webhook, NOT GitHub Actions.** There is no GH Actions deploy workflow
  in any LD branch — only CI (lint/check/test/lighthouse). See the mechanism below.

---

## The deploy mechanism (researched)

1. Push to `livingtongues/living-dictionaries`, branch = `living.conf:DEPLOY_BRANCH`
   (**`svelte-5-migration`** — now also this repo's work branch, so deploy needs no branch flip).
2. GitHub webhook → VPS `hooks.json` matches `refs/heads/${DEPLOY_BRANCH}` → runs `deploy.sh`.
3. `deploy.sh` (generated by `~/code/vps-setup/bin/sync` → `generate_deploy_sh`): mints a GitHub App
   token, clones/`git reset --hard $BRANCH` into `/opt/hosting/sveltekit/code`; **preflight** greps
   `$env/static/{private,public}` imports under `code/site/src` — every var must exist in
   `/opt/hosting/sveltekit/.env` or it aborts in <1s (before the ~8-min build); `cp .env code/.env`;
   `docker compose build && docker compose up -d`.
4. `docker-compose.yml` (generated): `build: { context: ./code, dockerfile: Dockerfile }`;
   `env_file: .env`; volume `/opt/hosting/data:/data`; external `web` network (shared w/ Caddy);
   loopback `127.0.0.1:3001:3000` for the host health-monitor.
5. **Dockerfile lives in the app repo root** (context `./code` = repo root) — committed (`9919df8f`).

Caddy already reverse-proxies `new.livingdictionaries.app` → the `sveltekit` container (behind
Cloudflare "full" SSL, `tls internal`).

### Env vars the VPS `.env` must hold
- **Build-time STATIC (preflight-gated — missing = abort):**
  - `$env/static/public`: `PUBLIC_mapboxAccessToken`, `PUBLIC_STORAGE_BUCKET`
  - `$env/static/private`: `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_REGION`, `AWS_SES_SECRET_ACCESS_KEY`
    (via `send-email.ts`, reachable from auth send-code + `/api/email/*`). ⚠ living's current `.env`
    may lack these (the example used nodemailer) — placeholder passes build but email 500s.
- **Runtime DYNAMIC (`$env/dynamic/private`):** `JWT_SECRET`, `PUBLIC_GOOGLE_OAUTH_CLIENT_ID`,
  `GCLOUD_MEDIA_BUCKET_ACCESS_KEY_ID`, `GCLOUD_MEDIA_BUCKET_SECRET_ACCESS_KEY`, `PROCESS_IMAGE_URL`,
  `DATA_DIR=/data`.
- **R2 (for admin message attachments):** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_ATTACHMENTS_BUCKET`. Unset → reply-with-attachment throws; text
  reply + inbox/assign still work.

---

## REMAINING WORK

### 1. M3 deploy cutover — NEXT (Jacob-driven, collaborative)
Deploy *prep* is done & committed (`9919df8f`). VPS-side steps, at the cutover:
1. Ensure `secrets-decrypted/sveltekit-living.env` has every static + dynamic + R2 var above (esp.
   `AWS_SES_*`, `DATA_DIR=/data`); `bin/secrets-encrypt` + `bin/sync living`.
2. `DEPLOY_BRANCH` stays `svelte-5-migration` (no flip — the work now lives on the deploy
   branch); `setup/machines/living.conf` + the generated `hooks.json` already fire on it.
3. Push `svelte-5-migration` → `livingtongues/living-dictionaries` (webhook → deploy), OR manually
   `ssh living "/opt/hosting/sveltekit/deploy.sh"`.
4. **`.data` seeding (deferred to cutover):** first boot self-migrates to an empty catalog; then
   `rsync` local `site/.data/` (~21 MB — `shared.db` 8.5 MB + 5 dict DBs: achi, a-fala, svetsian,
   torwali, 80CcDQ4DRyiYSPIWZ9Hy) → `living:/opt/hosting/data/`.
5. Verify `https://new.livingdictionaries.app` boots + renders globe / catalog / a dict's entries.

### 2. Admin-port follow-ups
- Set R2 env on the VPS (above) so message attachments work.
- (Optional) `e2e/admin-flow.mjs`: dev-OTP admin → wa-sqlite admin sync → /admin/schema graph mounts
  → users / dictionaries / messages / sync lists; assert no `pageerror`.
- Live `:3041` authenticated eyeball (Jacob): OTP admin → admin sync → graph interactivity → a real
  message reply.
- **Still stubbed:** dict-delete R2-snapshot + orphaned-GCS-media cleanup (dict delete removes the
  row + the dict.db file, but not its snapshot/media). Separate follow-up.

### 3. Outstanding live verifications (Jacob, :3041)
- Visual/maps parity across the Svelte-5 site (globe + dictionary points need a real browser).
- A real media upload end-to-end (needs real GCS env set locally/VPS — agent can't reach GCS).

### Deferred (intentionally, by Jacob)
- ⛔ **R2 snapshot builder + cron** — not this month.
- The **legacy cutover runbook** (production DNS swap, catch-up Supabase→SQLite migration) — far
  future, after the staging deploy is proven on `new.livingdictionaries.app`.

---

## house — status only (its open work lives in house's own `.issues/`)
house (`repo-restructure`) is **deployed live on `new.hvsb.app`** (staging): auth + customer reader +
local-first admin sync + library editing all off Firestore, on the same wa-sqlite substrate. Its
remaining tasks (local-search phases, DNS/Stripe cutover, deferred niggles) are tracked in the house
repo, not here. The durable conventions above are the shared contract between the two.

## Reference pointers (where to peek in the example)
- Server SQLite: `site/src/lib/db/server/{shared-db,dictionary-db,get-dictionary}.ts`; schemas
  `site/src/lib/db/schemas/{shared,dictionary}.ts` (+ migrations).
- Sync engine: `site/src/lib/db/sync/*`. Deploy: `Dockerfile`, `docker-compose.yml`.
- Migration script: `packages/scripts/migrate-to-sqlite/`.
- **Knowledge (durable gotchas):** `.knowledge/migration/*` (build/deploy, lockfile discipline,
  runes migration, eslint config, sqlite read, write/sync, real auth, media upload, dict-sync
  invariants, UnoCSS plugin swap) and `.knowledge/testing/*` (browser deep-flow).

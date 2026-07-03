# Shared stack conventions (LD ↔ house)

The durable cross-project contract between **living-dictionaries** and **house** — both ride the
same wa-sqlite / JWT / SQLite / Svelte-5 substrate, so their `site/lib` infrastructure stays
near-identical. This page records the **decisions, rejected alternatives, and invariants that
aren't obvious from reading code** (the generic "what the stack is" lives in `AGENTS.md` / the
shared `WEB.md`). Relocated here from the old `.issues/cross-project-orchestration.md` so it
outlives the migration plan.

## Orchestration norms
- **One writer per tree, always.** Never run two *writing* agents in one working tree. We got
  burned twice (LD: admin-port + deploy WIP intermingled; house: deploy + search + auth WIP) and
  paid for it untangling-by-path at commit time. Serialize same-repo work.
- A child Horse session **cannot reply into a human-facing orchestrator session** (`horse send`
  only delivers to Horse-run sessions). Use a **file handoff** (an `.issues/` file) + Jacob relays
  "done".
- Each session: **PLAN + interview Jacob** before mass edits on big tasks; verify with the shared
  headless launcher (`import { launch } from
  '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'`, asserting `page.on('pageerror')`
  is empty); **commit on the feature branch, never push** (Jacob controls deploy pushes); Jacob
  eyeballs live UI/maps (LD :3041, house :5000 — agents can't do WebGL/maps; `curl` to :3041
  returns 000 in the sandbox, but `node build` localhost HTTP works).

## Stack & architecture decisions (carry forward to both repos)
- **Keep UnoCSS, global plugin** (`unocss/vite` + `extractorSvelte()` + `transformerDirectives()`).
  Never reintroduce `@unocss/svelte-scoped`; don't go plain-CSS in LD/house. (The *example* repo
  went plain-CSS; LD/house deliberately did not — see
  `unocss-svelte-scoped-to-universal.md`.)
- **Vendor svelte-pieces** into each repo (Svelte 5). **adapter-node**; native deps
  (`better-sqlite3`, etc.) MUST live in `dependencies`, not `devDependencies` — adapter-node
  externalizes `dependencies` and bundles `devDependencies`, so a native module in devDeps breaks
  the build.
- **Auth = Email-OTP + JWT + SQLite `users` + allow-lists. Permissions stay NUMERIC** — the full
  named-roles migration was designed and **REJECTED by Jacob; don't re-propose.** LD (2026-07-03):
  effective levels 0-3 — 3 Super Admin / 2 Admin hardcoded (`AdminLevel = 2 | 3` in
  `$lib/admins.ts`), 1 Super Manager granted via the `users.roles` JSON column (`SITE_ROLES`,
  toggleable from /admin/users/[id]; dictionary-manager powers on every dict, NO /admin access —
  a DB write can never escalate into the admin club) + dev `dev_admin_level` cookie (0-3).
  house: `level` 1/2/3 + `is_editor`. The `users.roles` array is the sanctioned escape hatch for
  future orthogonal grants (e.g. `super_editor`) — extend it before reaching for role tables.
- **wa-sqlite local-first sync engine** (browser DB + SharedWorker + bidirectional `/changes` sync)
  is the shared write/sync substrate. **Sync-engine invariants to keep:**
  - clear `dirty` ONLY by **pushed row id** (NOT blanket `WHERE dirty=1` — junction rows silently
    never sync otherwise);
  - `db_metadata` triggers use `ON CONFLICT DO UPDATE` (NOT `INSERT OR REPLACE`, which 500s under
    an upsert);
  - `/changes` fast-bail must NOT drop pushes when `cursor == watermark`;
  - `ensure_initial_sync()` before any writes; keep a local `users` row so FKs resolve; deletes are
    sector-scoped.
- **Runes gotchas:** `bind:value` to a `$derived` silently no-ops; `$state` bound to a child's
  non-undefined `$bindable(x)` fallback throws `props_invalid_value` at mount.
- **R2 = DB snapshots + admin message attachments, NOT media bytes.** Media bytes stay on legacy
  **GCS** (LD: serving URLs built via `PUBLIC_STORAGE_BUCKET`, prod
  `talking-dictionaries-alpha.appspot.com`) / Firebase Storage (house) — **no media→R2 migration.**
  R2 IS used for DB **snapshots** (`R2_SNAPSHOTS_BUCKET`, `lib/r2/client.ts`) and message
  **attachments** (`R2_ATTACHMENTS_BUCKET`, `lib/r2/put-attachment.ts`). R2 vars are
  `$env/dynamic/private` (runtime, NOT preflight-gated).
- **Deploy = vps-setup GitHub webhook, NOT GitHub Actions.** There is no GH Actions deploy workflow
  in any LD branch — only CI (lint/check/test/lighthouse). The deploy mechanism + the env-var
  contract are documented in `.issues/cutover.md`.

## house status (its open work lives in house's own `.issues/`)
house (`repo-restructure`) is **deployed live on `new.hvsb.app`** (staging): auth + customer reader
+ local-first admin sync + library editing all off Firestore, on the same wa-sqlite substrate. Its
remaining tasks (local-search phases, DNS/Stripe cutover, deferred niggles) are tracked in the
house repo, not here. The conventions above are the shared contract between the two.

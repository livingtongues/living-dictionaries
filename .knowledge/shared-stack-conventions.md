# Shared stack conventions (LD ↔ house)

The durable cross-project contract between **living-dictionaries** and **house** (and increasingly
**tutor**, the third app on the same substrate) — all ride the same wa-sqlite / JWT / SQLite /
Svelte-5 stack, so their `site/lib` infrastructure stays near-identical in shape. This page records
the **decisions, rejected alternatives, and invariants that aren't obvious from reading code**; the
generic "what the stack is" lives in each repo's `AGENTS.md` and in the shared
`~/code/otter/claude/WEB.md`. Relocated here from the old `.issues/cross-project-orchestration.md`
so it outlives the migration plan.

> Anything here that contradicts `AGENTS.md` or `WEB.md` is stale by definition — those two are
> refreshed with the code. Fix this page rather than following it (a styling-era bullet telling
> agents to "keep UnoCSS" survived here for six weeks after UnoCSS was deleted from both repos).

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
  is empty); **commit on the branch you were given, never push unless Jacob says so** — both repos
  now live and deploy from `main` (LD since 2026-07; house's `repo-restructure` was merged), so a
  push IS a production deploy and is Jacob's call, not the agent's; Jacob
  eyeballs live UI/maps (LD :3041, house :5000 — agents can't do WebGL/maps; `curl` to :3041
  returns 000 in the sandbox, but `node build` localhost HTTP works).

## Stack & architecture decisions (carry forward to both repos)
- **UnoCSS is GONE from both repos (2026-06-12) — never reintroduce it**, in any form (universal
  `unocss/vite` or `@unocss/svelte-scoped`). Styling is hand-written **scoped CSS** over a small
  global layer of semantic custom properties: `$lib/theme.css` (vars + body paint + `color-scheme`)
  → `$lib/buttons.css` (`.btn-*`) → `$lib/forms.css`, with dark mode live in both (system
  `prefers-color-scheme` + a 3-way user toggle). Earlier revisions of this page said the opposite
  ("keep UnoCSS, don't go plain-CSS") and pointed at a `unocss-svelte-scoped-to-universal.md` that
  no longer exists — that reversal is the decision, corrected 2026-07-28. Two mode gotchas that bit
  both repos: `var()` inside an unregistered custom property substitutes **eagerly at the declaring
  element**, so a derived var declared only on `:root` freezes the light value under a toggle-forced
  `body.dark` (re-declare it in every mode block); and `light-dark(a, b)` is the clean one-off for
  mode-conditional values in component CSS. LD's diacritics-safe Segoe/Arial/Noto font stack is
  deliberate — never "modernize" it to system-ui.
- **`svelte-pieces` is dissolved** — vendoring it into each repo was the old answer; both repos have
  deleted the folder. Reusable primitives live in `lib/components/ui/`, app chrome in
  `lib/components/shell/`, pure helpers + DOM attachments in `lib/utils/`, reactive modules in
  `lib/state/`, and feature-owned code in a top-level `lib/<feature>/`. No barrels — import files
  directly. Byte-identity across repos is NOT the goal; align where convenient.
- **adapter-node**; native deps
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
- **wa-sqlite local-first sync engine** (browser DB + bidirectional `/changes` sync) is the shared
  write/sync substrate. Persistence is **OPFS inside a leader-elected dedicated worker** in both
  repos — `navigator.locks` elects ONE leader (house per origin, LD per dictionary), only the leader
  spawns the worker owning the OPFS DB, other tabs RPC it over a BroadcastChannel. It replaced the
  IndexedDB/SharedWorker model after LevelDB write-amplification froze whole machines under btrfs;
  tutor is the one still on IndexedDB + SharedWorker. The worker harness is **copy-paste-shared per
  the manifest in house `$lib/db/worker/PARITY.md` (test-enforced) — read that before syncing either
  repo.** GOTCHA: a snapshot fed to the OPFS VFS must carry a rollback-journal header
  (`journal_mode = DELETE` server-side; a WAL header → `SQLITE_CANTOPEN`).
  **Sync-engine invariants to keep:**
  - clear `dirty` ONLY by **pushed row id** (NOT blanket `WHERE dirty=1` — junction rows silently
    never sync otherwise);
  - `db_metadata` triggers use `ON CONFLICT DO UPDATE` (NOT `INSERT OR REPLACE`, which 500s under
    an upsert);
  - `/changes` fast-bail must NOT drop pushes when `cursor == watermark` — and the rule generalizes
    to ANY new request field (it bit twice: editor pushes, then LD's read-only `dirty_probes`, whose
    senders are by definition fully caught up). Every request term needs its own term in the bail;
  - `dirty` is CLIENT-only — never write it server-side; `server_seq` is what carries a server write
    to clients, and only the SERVER may vouch that a client's dirty flag is redundant (a lapsed
    editor is a non-editor holding real work);
  - `ensure_initial_sync()` before any writes; keep a local `users` row so FKs resolve; deletes are
    sector-scoped.
- **Runes gotchas:** `bind:value` to a `$derived` silently no-ops; `$state` bound to a child's
  non-undefined `$bindable(x)` fallback throws `props_invalid_value` at mount.
- **R2 stores LD media, DB snapshots, imports, and admin message attachments.** User media lives in
  `livingdictionaries-media` behind `media.livingdictionaries.app`; snapshots and attachments use
  their dedicated buckets. R2 vars are `$env/dynamic/private` (runtime, NOT preflight-gated).
- **Deploy = vps-setup GitHub webhook, NOT GitHub Actions.** There is no GH Actions deploy workflow
  in any LD branch — only CI (lint/check/test/lighthouse). The deploy mechanism + the env-var
  contract are documented in [supabase-cutover.md](./supabase-cutover.md).
- **Robot classification is ONE canonical file, copied VERBATIM into every repo**
  (`site/src/lib/utils/bot-user-agent.ts`; LD's copy landed 2026-07-28, adopted byte-for-byte from
  house — **all three apps now carry the identical file**, sha256 `b8a712ce…`). Jacob, 2026-07-27,
  overriding two earlier standing decisions: one implementation, adopted
  verbatim, plus **a test that fails when the copies drift** (LD: `bot-user-agent.parity.test.ts`,
  which reads the sibling repos out of `~/code` and skips gracefully when they aren't checked out).
  It exports TWO functions with identical signatures and deliberately OPPOSITE missing-UA policy —
  `is_bot_user_agent` (missing UA = human) and `is_bot_or_unknown_user_agent` (missing UA = robot).
  **Anything gating a whole app surface must use the FIRST**: LD's dictionary boot gate hands a
  robot a null session, so failing closed on a UA-less request means a blank application. The
  precision rules that make it safe — word boundary on `bot|crawler|spider`, device-brand stripping
  (CUBOT is a phone), and `whatsapp` only counting without a `mozilla` token (WhatsApp's in-app
  browser is a real reader) — exist because LD's own substring regex blanked the app for those
  people on 2026-07-27.

## house status (its open work lives in house's own `.issues/`)
The migration is **over**: house merged `repo-restructure` into `main` and serves real customers at
`hvsb.app` — auth, the customer reader, local-first admin sync and library editing all off Firestore,
on the same wa-sqlite substrate. The `new.hvsb.app` staging phase and the DNS/Stripe cutover are
history (this page said otherwise until 2026-07-28). Everything house is now doing lives in house's
own `.issues/` and `AGENTS.md`; the conventions above are the shared contract between the two.

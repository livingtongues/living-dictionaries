# Cross-project orchestration — living-dictionaries × house

I (this session) orchestrate the parallel modernization of **two** Svelte-4 apps that are
both: bumping to **Svelte 5 + latest Vite/UnoCSS**, ripping out a hosted backend
(**Supabase** in LD, **Firebase** in house) for **our own SQLite**, vendoring shared UI,
and verifying nothing broke with **puppeteer-core + system Chrome**. Decisions made in one
usually apply to the other — this file is the shared ledger + the next-step chart. Sub-sessions
report back here; I relay learnings and Jacob's decisions across the fence.

> The two apps live in separate repos with their own `.issues/` + `.knowledge/`. This file is
> the **orchestration index**; per-project plans stay in their own repos (linked below).

## Where each app is (2026-06-04)

| | **living-dictionaries** (`vps-migration`) | **house** (`repo-restructure`) |
|---|---|---|
| Backend being removed | Supabase (Postgres + auth) | Firebase (Firestore + auth + storage) |
| Strategy | morph `main` in place; example repo = parts-bin | morph old live `/site` in place; `/learn-from` = blueprint |
| Relocate to `site/` | ✅ M0 | ✅ (chameleon restructure) |
| adapter-node (off Vercel) | ✅ M0.5 | ✅ (sqlite-auth Phase A) |
| Backend **stubbed/removed** | ✅ M1 (zero Supabase, dummy data, logged-out) | n/a — keeping Firestore DATA reads for now |
| UnoCSS svelte-scoped → universal | ✅ M2a | ✅ |
| Latest toolchain (Vite 8 / vps7 / svelte 5.56 / kit 2.62 / vitest 4 / ts 5.9) | ✅ M2b P1 | ✅ |
| Vendor svelte-pieces (→ Svelte 5) | ✅ M2b P2 (copied house's set) | ✅ (vendored first) |
| Kitbook → svelte-look | ✅ M2b P3 | ✅ |
| **Runes codemod** (component syntax) | ❌ **not yet — this is M2c, the next big step** | ✅ DONE (142 files; 0 err / 6 warn) |
| Lint clean + hook re-enabled | partial (eslint clean on touched files) | ✅ DONE |
| SQLite + Email-OTP/JWT auth **backend** | ❌ (M4, later) | ✅ Phase A (better-sqlite3, jose, endpoints, 112 tests) |
| App identity on new auth | ❌ | ✅ Phase B core committed (`2253f0c`) |
| Login modal UI + Google One-Tap | ❌ | 🔶 **in progress** (idle session, mid-interview) |
| Real backend DATA reads on SQLite | ❌ (M4) | ❌ (still Firestore; the big remaining swap) |
| puppeteer-core deep-flow e2e | ✅ `site/e2e/achi-flow.mjs` (own launcher) | ✅ `tools/e2e/*` (uses shared skill launcher) |
| Uses shared `browser-launch.mjs` (new skill) | ❌ — still its own puppeteer-core+chrome-launcher | ✅ adopted (`efedb37`) |
| Working tree | **dirty** (M2b + puppeteer work uncommitted) | clean |

## What each needs to do NEXT

### living-dictionaries
1. **Commit the dirty tree first** — M2b (svelte-pieces vendoring, kitbook→svelte-look, mock-user,
   dummy entries) + the puppeteer-core deep-flow swap are all uncommitted on `vps-migration`.
   Land them as a checkpoint before the runes churn so M2c is bisectable.
2. **M2c — migrate component syntax to runes** (the next milestone; mirrors what house already did).
   This is the prime cross-learning beneficiary — see house's runes-codemod gotchas below. 0 errors /
   **484 warnings** today (all Svelte-5 legacy deprecations) → drive to ~0 via the codemod + hand-fixes.
3. **Adopt the shared `browser-launch.mjs`** in `site/e2e/achi-flow.mjs` (house already did) — small.
4. Then **M3** (Docker + VPS deploy of the stubbed app) → **M4+** (SQLite read → write/sync →
   **real auth** [port house's backend] → media → R2).

### house
1. **Finish login modal UI + Google One-Tap** (sqlite-auth Phase B tail). The idle session
   `3367d00b` is paused **mid-interview** awaiting 3 answers: `toast` (alert vs port toast system),
   `popover` (modal button only vs auto one-tap), `clientid` (`PUBLIC_GOOGLE_OAUTH_CLIENT_ID` plan).
   Decisions already locked earlier in that session: Modal-only entry, port Google One-Tap, stay-on-page
   + `invalidateAll()`, repoint `AuthSubscribeGuard`, port full `update-profile` (wire newsletter toggle
   only), **fix the send-code rate-limit bug now**.
2. **Fix the inherited send-code rate-limit bug** (429 unreachable — the invalidating DELETE wipes the
   count) — applies to LD's future auth too; fix in `/learn-from` upstream as well.
3. Then the **big backend swap: Firestore DATA reads → SQLite** (articles/scripture/media), then deploy,
   then the one-time data migration + hosting cutover (`port-customer-site-from-old.md`).

## Cross-project shared-learning ledger

**House → LD (house is ahead on the Svelte-5 path; feed these into LD's M2c):**
- The interactive `sv migrate svelte-5` / `svelte-migrate` CLI **hangs at 99% CPU in non-TTY**
  (clack prompts busy-loop on piped stdin). Workaround that worked: call the migration's
  `transform_module_code`/`transform_svelte_code` functions directly from a Node driver, **one
  child process per file with a 30s timeout** so a single hung file can't block the batch.
- Hand-fix the files the codemod can't: `@migration-task` comments; `ComponentProps<X>` →
  `ComponentProps<typeof X>`; `each_item_invalid_assignment` (runes) → `bind:value={array[index]}`
  instead of `bind:value={each_arg}`; `$app/stores` → `$app/state` **template** gaps (codemod
  converts script+import but misses `$page.` in markup); slot/store & slot/prop name collisions
  when slots become snippet-props (rename the snippet prop).
- Silence a11y/legacy warnings via **`compilerOptions.warningFilter` in `svelte.config.js`**
  (honoured by svelte-check; the old `onwarn` is not).
- Svelte-5 build (Rolldown) **fatally** rejects empty CSS decls (`;;`) and strict HTML nesting
  (`<tr>` needs `<tbody>`, no nested `<form>`) — `check` only warns, build errors. (LD already hit
  these in M2b; same class of issue recurs in runes conversion.)
- House's **already-built SQLite + Email-OTP/JWT auth backend** (`jwt.ts`, `verify.ts`,
  `admins.ts` allow-list, `find-or-create-auth-user.ts`, OTP email on existing components, the
  send-code/verify/me/logout endpoints, 112 tests) is the **direct template for LD's M4 real-auth**.

**LD → house (LD is ahead on the deep-flow e2e pattern):**
- LD's `site/e2e/achi-flow.mjs` is a clean **single-script deep flow** (self-boot `node build` →
  drive N interactions → assert → screenshot → teardown). Gotchas baked in, reusable by house:
  headless Chrome defaults to a **non-English locale** (set `Accept-Language: en-US` + `--lang=en-US`);
  ambient `PORT`/`FLOW_PORT` shell vars leak in (use a dedicated var); **`innerText` not `textContent`**
  for visible-text assertions (textContent keeps source whitespace, breaks `"1-13 / 13"`); Svelte
  input edits need the native value setter + `input`/`change` dispatch.

## Standing decisions (apply to BOTH, and to future work)
- **Verify with puppeteer-core + system Chrome**, via the **new universal `browser-launch.mjs`**
  (`import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'`) — fresh
  isolated headless browser, no per-repo puppeteer dep, no binary downloads (Jacob's slow internet).
  Capture `page.on('pageerror')` + console errors and assert empty (how runes regressions surface).
  Auth without a login UI: drive the app's own auth API from inside the page to set the session cookie.
  House's `tools/e2e/auth-ui.mjs` is the multi-state reference. **LD still needs to adopt the shared
  launcher.** No Playwright (downloads a browser per version) — LD already removed it.
- **Keep UnoCSS, global plugin only** (`unocss/vite` + `extractorSvelte()` + `transformerDirectives()`).
  **Never reintroduce `@unocss/svelte-scoped`.** Don't go plain-CSS in these two (that's tutor's path).
- **Vendor svelte-pieces into the repo**, port to Svelte 5, keep UnoCSS classes. New svelte-pieces
  needs in either repo → check the other's vendored set first. (House's runes ShowHide/Form throw
  `invalid_default_snippet` under legacy `let:` consumers → LD kept those two on svelte-pieces LEGACY
  source. Revisit once LD's consumers are runes too.)
- **Latest toolchain, matched across both:** Vite 8, vite-plugin-svelte 7.1, svelte 5.56, kit 2.62,
  svelte-check 4.5, vitest 4.1, ts 5.9, unocss 66, preset-forms 2.
- **Auth = Email-OTP + JWT + SQLite users + admin/editor allow-lists.** One shared design; house
  built it first, LD ports at M4. Dev path returns the code (no UI needed for e2e).
- **adapter-node**, `DATA_DIR` env (`.data` local, `/opt/hosting/data` VPS), better-sqlite3 native
  (`pnpm.onlyBuiltDependencies`), Docker → VPS via `~/code/vps-setup` sync.
- **Lockfile fidelity:** structural changes honor the committed lockfile; never let plain install drift.
- One reversible thing at a time; app builds + boots at every checkpoint. Jacob runs the dev servers
  (LD :3041, house :5000) and eyeballs live UI/maps. Commit only when Jacob says so.

## Open shared bugs to fix in both
- **send-code rate-limit unreachable** (429 never fires; invalidating DELETE wipes the count). Found in
  house; same logic will land in LD's M4 auth. Fix in house + `/learn-from` upstream so LD inherits it fixed.

## Sessions in flight
- **LD-A** — ✅ spawned `2026-06-04`, session `cc59407a` (project `living-dictionaries`, linked to
  orchestrator). Brief: commit the dirty M2b/puppeteer tree → **M2c runes migration** (house's
  codemod gotchas pre-loaded) → adopt the shared `browser-launch.mjs` in `achi-flow.mjs`. Will report
  back here on completion + any house-applicable learnings. Verify gate: check 0 err / warnings driven
  down · test 123 · build + boot · `test:flow` 5/5 · headless pageerror-empty.
- **HOUSE-A** — **Jacob is driving this himself** (login modal + Google One-Tap, Phase-B tail; +
  the send-code rate-limit bug). Not spawned by me. I still track its learnings here when they land —
  esp. the finished OTP/JWT/Google auth surface, which becomes LD's M4 real-auth template.

Each sub-session reports its result back here; I fold gotchas/decisions into the ledger above and
cross-pollinate to the other project.

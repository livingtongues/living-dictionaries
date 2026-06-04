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
| **Runes codemod** (component syntax) | ✅ **DONE (M2c)** — 367 files; 0 err / 15 warn | ✅ DONE (142 files; 0 err / 6 warn) |
| Lint clean + hook re-enabled | ✅ DONE (LD-A2: custom flat config, finished runes stragglers) | ✅ DONE |
| SQLite + Email-OTP/JWT auth **backend** | ❌ (M4, later) | ✅ Phase A (better-sqlite3, jose, endpoints, 112 tests) |
| App identity on new auth | ❌ | ✅ Phase B core committed (`2253f0c`) |
| Login modal UI + Google One-Tap | ❌ | 🔶 **in progress** (idle session, mid-interview) |
| Real backend DATA reads on SQLite | ❌ (M4) | ❌ (still Firestore; the big remaining swap) |
| puppeteer-core deep-flow e2e | ✅ `site/e2e/achi-flow.mjs` (own launcher) | ✅ `tools/e2e/*` (uses shared skill launcher) |
| Uses shared `browser-launch.mjs` (new skill) | ✅ adopted (M2c; dropped local puppeteer-core+chrome-launcher) | ✅ adopted (`efedb37`) |
| Working tree | clean (M2b `6aa75c16` + M2c committed) | clean |

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
- **HOUSE-DATA → LD M4 · SQLite read (the playbook is now written):** house's
  `.knowledge/architecture/firestore-to-sqlite-reader-port.md` captures the reusable moves — convert
  the reader's **universal `+layout.ts` → server `+layout.server.ts`** (SQLite is server-only), use an
  **isomorphic `load_*({ db })` seam** + **pure projections** that adapt SQLite rows back to the
  *existing legacy view shapes* (so components don't change), keep scripture/HTML-on-disk as a separate
  stream from media, and when seeding from an already-local DB **preserve the destination's
  `migrations` row** so its migration runner stays idempotent. ⚠️ **adapter-node native-deps gotcha
  (would bite LD's VPS deploy too):** `better-sqlite3` MUST be in **`dependencies`**, not
  `devDependencies` — adapter-node **bundles devDeps but externalizes deps**; in devDeps it inlines the
  `bindings` loader → `__filename is not defined` crash on first DB hit. (LD already saw a sibling
  `__filename` SSR crash in M1 from a different cause; same adapter-node mechanism.) See house
  `.knowledge/tooling/adapter-node-native-deps.md`.

**LD → house (LD is ahead on the deep-flow e2e pattern):**
- LD's `site/e2e/achi-flow.mjs` is a clean **single-script deep flow** (self-boot `node build` →
  drive N interactions → assert → screenshot → teardown). Gotchas baked in, reusable by house:
  headless Chrome defaults to a **non-English locale** (set `Accept-Language: en-US` + `--lang=en-US`);
  ambient `PORT`/`FLOW_PORT` shell vars leak in (use a dedicated var); **`innerText` not `textContent`**
  for visible-text assertions (textContent keeps source whitespace, breaks `"1-13 / 13"`); Svelte
  input edits need the native value setter + `input`/`change` dispatch.
- **Runes-migration learnings house can confirm/reuse** (LD ran the same codemod after house;
  durable page: LD `.knowledge/migration/svelte-5-runes-migration.md`):
  - Run the codemod from a **per-file Node driver, one child process + 30s timeout** (the
    interactive CLI hangs in non-TTY) — import `migrate` from the project's own svelte 5 compiler at
    `node_modules/svelte/src/compiler/index.js` (the `./compiler` *require* entry doesn't export it);
    install `svelte-migrate` in a throwaway dir so the lockfile never drifts; exclude vendored
    svelte-pieces.
  - **Legacy slot → runes snippet interop:** a runes parent passing `{#snippet name()}` to a legacy
    `<slot name>` component **type-errors** in svelte-check though it often runs. Convert the vendored
    slot component to runes once all consumers are runes; in a **JS** vendored file, snippet props
    need `= undefined` defaults or they're inferred *required* and break every consumer.
  - **`bind:value={item.member}` is NOT `each_item_invalid_assignment`** — only the bare each-item
    identifier triggers it; don't rewrite member binds.
  - **eslint-plugin-svelte@2.43's `svelte/indent` stack-overflows on Svelte 5** + `no-use-before-define`
    false-positives (no runes-hoisting model). ⚠️ **CORRECTION (orchestrator):** the LD-A child wrote
    "house kept lint off for the same reason" — that is **wrong**. **House bumped to
    `eslint-plugin-svelte@^3.17.1`** (+ the `github:jacob-8/eslint-plugin-svelte-stylistic` fork) and
    got `pnpm lint` to **0 errors** (`lint-clean-and-reenable-hook.md`, re-enabled in its pre-commit
    hook). So **LD's lint unblock = bump 2.43 → 3.17.1 to match house** (LD is still on `^2.43.0`), not
    "keep lint off". `--fix --rule '{"svelte/indent":"off"}'` was the interim hack on the old plugin.
- **LD-A2 lint outcome (2026-06-04):** LD went **fully custom** (ported the example's hand-written flat
  config — same stack as house: eslint 10 / svelte-plugin 3 / parser 1 / @stylistic / canonical names),
  not antfu-overrides. `pnpm lint:fix` repo-wide churn was **~125 files but purely stylistic**
  (perfectionist import-sorting, quote/comma normalization, `import-x/consistent-type-specifier-style`
  splitting inline `type` imports) — behavior-neutral; expected one-time cost of adopting the config.
- **Finishing the runes migration to satisfy lint (svelte-pieces gotchas, house can reuse):**
  - In **runes mode `<slot>`, `$:`, `$$props` are hard ERRORS**, but `createEventDispatcher` + consumer
    `on:event` stay *warnings* — so converting a piece's props to `$props()` forces converting its
    slots→snippets and `$:`→`$derived`/`$effect` too (all-or-nothing), but you can defer the event→callback
    swap. We did swap events→callback props (`on:valueupdated`→`on_valueupdated`, etc.) for cleanliness.
  - The M2c codemod **already converted slot-prop CONSUMERS to `{#snippet children({…})}`** while the
    pieces stayed legacy `<slot {x}>` — so converting the pieces to `{@render children?.({x})}` *aligns*
    with consumers; only component-**event** consumers (`on:foo`) needed edits. Audit before churning.
  - `import-x/no-mutable-exports` fires on Svelte `export let` (false-positive for legacy props) — the
    real fix is converting to `$props()`, not disabling.
  - **A `let state` variable breaks the `$state` rune** (svelte-check: "$state used before declaration" /
    "untyped call may not accept type args") — rename the variable (the migration tool flags this).
  - **JS action with a custom event** needs the event typed for `on<event>` in a lang=ts consumer:
    `@type` JSDoc on a `function`/`const` did NOT bind; converting `longpress.js`→`.ts` with
    `Action<HTMLElement, P, { onlongpress?: (e: CustomEvent)=>void }>` worked.
  - **`{#each}` keys (svelte/require-each-key):** DB-row arrays→`(x.id)`, string arrays→`(x)`,
    `Object.entries`→`(key)`, `SelectOption`→`(x.value)`, device lists→`(x.deviceId)`,
    roles→`(x.user_id)`; fixed-range / id-less / uncertain → index (behavior-identical to pre-key).
  - **`@typescript-eslint/ban-types` was removed in TS-ESLint v8** → stale `// eslint-disable … ban-types`
    (and antfu `ts/*` aliases) throw "Definition for rule not found" under eslint 10. Replace `Function`
    with `(...args: any[]) => any` and delete the directive. `new Error(msg,{cause})` may exceed the TS
    lib target (Expected 0-1 args) → keep single-arg + disable `preserve-caught-error` with a reason.

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
> **Reporting note (updated 2026-06-04):** the old `horse spawn --session <id>` reply path didn't reach
> the human's interactive session. **HORSE-CLI fixed this** — there's now a real **`horse send <id>
> "msg"`** that drops the note into a per-session **inbox**, drained as a real user turn (idle-wake path
> verified live; busy-mid-turn path coded, not yet exercised). CLI was slimmed: **`spawn` = new session
> only** (no `--session` resume), **`send` = message an existing session**, `run`/`projects` cut,
> `status` folded into `list <id>`, parent flags/banner removed, `HORSE_DEFAULT_PROVIDER` honored. ⚠️
> These changes are **uncommitted** in the horse repo — until committed + relinked, keep using the
> current CLI; `horse spawn` (new session) is unchanged and safe. Jacob still relays "done" for now.
> **Same-repo serialization:** never run two agents in one working tree at once.

- **LD-A** — ✅ DONE (`cc59407a`). M2c runes migration: 367 files, check 0 err / 15 warn, test 123,
  build+boot, achi-flow 5/5. Commits `6aa75c16` (M2b) + `f6ad5ad2` (M2c) on `vps-migration` (not pushed).
  Adopted shared `browser-launch.mjs`. Reply-to-parent failed (see note) — result fetched from artifacts.
- **HORSE-CLI** — ✅ DONE (`0d6acd8d`). Went past investigation and **built the fix**: per-session
  **inbox** + **`horse send`**, verified live end-to-end (send→flush→drain→agent acts on it→inbox
  cleared→delete). Slimmed CLI: `spawn`=new-only, `send` added, `run`/`projects` cut, `status` folded
  into `list <id>`, parent flags+banner removed, `HORSE_DEFAULT_PROVIDER` honored. Help/AGENTS/skill
  updated. **Open:** busy-mid-turn send path not yet exercised live. Tracked in
  `~/code/horse/.issues/cli-messaging-and-slimming.md`. **Nothing committed.**
- **LD-A2** — ✅ DONE (`4c4b59fd`). Two commits on `vps-migration` (not pushed):
  (1) **`4499a358`** — fix `entry.worker.ts` SENSE DUPLICATION: the module-level grouping maps
  (`entry_id_to_senses`/`_to_audios`/`_to_tags`/`_to_dialects`, `sense_id_to_*`, `*_id_to_sense_ids`,
  `audio/video_id_to_speakers`) were only `.push()`ed, never reset; `init_entries` re-runs on the
  persistent worker (SPA re-entry of `[dictionaryId]` layout, CDN-cache + dummy passes) → N copies.
  Fix = `reset_grouping_maps()` (let-rebind to `{}`) before the bulk push loops; deduped id-keyed dicts
  + incremental ops unaffected. Prod (single load) was never affected.
  (2) **`5d1e9354`** — `pnpm lint` → 0 errors. Jacob redirected to **go FULLY CUSTOM like the
  example/house** (not antfu): ported `living-dictionaries-example`'s hand-written flat config (eslint 10,
  eslint-plugin-svelte@3 + svelte-eslint-parser@1, @stylistic, import-x/n/perfectionist/regexp/unicorn/
  jsonc/@vitest, canonical namespaces), scoped to `site/`+root. Then **finished the runes migration of the
  legacy stragglers** rather than disabling rules (Jacob's call). Re-enabled `.githooks/pre-commit`
  (test→check→lint:fix→re-stage) + `prepare` hooksPath. Deleted stale `site/.vercel`.
  Gate: check 0/15 · test 123 · build+boot · achi-flow 5/5 · sense-dup repro 1 sense · 9-route headless
  scan 0 real errors · lint 0.
- **M3** — ⏸ DEFERRED TO LAST (Jacob). **Deploy = an existing GitHub Actions workflow auto-deploys
  pushed code to `new.livingdictionaries.app`** — NOT a manual `vps-setup` sync, NOT `staging.*`. The
  deploy workflow is **not even in `vps-migration`'s `.github/workflows/`** (lives on/aimed at another
  branch); Jacob **re-aims it to `vps-migration` and pushes at the very END** to test. Nothing to
  prep-spin now (build is already adapter-node + boots). Revisit only when Jacob says "do the deploy".
- **LD status — clean checkpoint; M2c visual parity CONFIRMED** (Jacob eyeballed :3041 maps 2026-06-04 →
  good). Fully-runes, lint-clean, green. **Next: M4 · SQLite read — now UNBLOCKED** (HOUSE-DATA done; its
  playbook + gotchas are ready to lean on). Uncommitted docs only (`.knowledge` + these `.issues`).
- **HOUSE-DATA** — ✅ DONE (`6794244c`). Customer reader now reads from SQLite in **4 verified phases**
  (seed `site/.data/shared.db` from local learn-from DB → chapter reader `+layout.server.ts` → leaf
  doc/img/vid `+page.server.ts` → retire Firestore reader helpers). Verified via `tools/e2e/reader-sqlite.mjs`:
  MAT.1+JHN.3 real scripture+media, all 4 leaves from SQLite, **0 Firestore calls / 0 pageerrors**, admin
  unpublished 77→188. check 0 · test 147 · build clean. Decisions: copy content tables · intros/series stay
  on Firestore (not imported) · no paywall · isomorphic `load_*({ db })` seam. **Nothing committed.**
  **Deferred:** intro/series import, Vimeo thumbnail caching, paywall port, an `include_unpublished`
  integration test. 📘 **Cross-repo knowledge for LD M4:** `.knowledge/architecture/firestore-to-sqlite-reader-port.md`
  + the adapter-node native-deps gotcha below.
- **HOUSE-A** — **Jacob is driving this himself** (login modal + Google One-Tap, Phase-B tail; +
  the send-code rate-limit bug). Not spawned by me. I still track its learnings here when they land —
  esp. the finished OTP/JWT/Google auth surface, which becomes LD's M4 real-auth template.

Each sub-session reports its result back here; I fold gotchas/decisions into the ledger above and
cross-pollinate to the other project.

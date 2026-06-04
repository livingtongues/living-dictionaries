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
| SQLite + Email-OTP/JWT auth **backend** | ✅ **M4 real-auth DONE** (OTP/JWT/Google + dict-roles) | ✅ DONE (Phase A/B) |
| App identity / login UI on new auth | ✅ DONE (AuthModal/account rewired) | ✅ DONE (login modal + Google One-Tap) |
| **Real backend DATA reads on SQLite** | ✅ **M4-read DONE** (catalog 2136 dicts + per-dict entries) | ✅ reader + **admin** both Firestore-free |
| **Write path on SQLite** | 🔶 **M4-write/sync in flight** (LD-WRITE) | 🔶 admin writes ✅ (sync engine); library editing in flight |
| puppeteer-core deep-flow e2e | ✅ `site/e2e/achi-flow.mjs` (shared launcher) | ✅ `tools/e2e/*` (shared launcher) |
| Uses shared `browser-launch.mjs` (new skill) | ✅ adopted (M2c) | ✅ adopted (`efedb37`) |
| Working tree | clean (through M4-read) | clean (through reader) |

## What each needs to do NEXT

### living-dictionaries  (M0–M2c + lint + M4-read all ✅ DONE & committed on `vps-migration`)
1. **M4 · real auth** (recommended next) — port house's already-built & proven OTP/JWT/SQLite auth +
   login modal + Google One-Tap; **inherit the send-code rate-limit FIX** house applied. Replaces the M1
   stub at the auth chokepoint → unblocks logged-in surfaces (admin list, my-dictionaries) off the stub.
2. **M4 · write/sync** — wa-sqlite browser + SharedWorker + bidirectional sync engine. **HOLD until
   house's local-first admin-sync engine lands** (HOUSE-ADMIN may build it) so LD inherits the wa-sqlite/
   sync playbook — same cross-pollination that made M4-read smooth.
3. **Media upload** (legacy GCS presigned PUT) → **R2 snapshots** → then **M3 deploy** (save-for-last;
   existing CI → `new.livingdictionaries.app`, Jacob re-aims the branch at the very end).

### house  (auth ✅ · customer reader 100% Firestore-free ✅)
1. **Admin surface off Firestore → SQLite** — HOUSE-ADMIN (`0a9cfdc3`) in flight (server-reads first,
   then full local-first sync). Or pivot to **local search** (Algolia → local data).
2. **Library editing on SQLite** (deferred — needs the local-first sync foundation first).
3. Then **data migration + hosting cutover** (`port-customer-site-from-old.md`): Firestore→SQLite
   one-time import, Stripe dedup, email archive, DNS/webhook flip.

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
- **M4 · SQLite-read learnings (LD applied house's reader playbook; house can reuse on its remaining
  swaps — durable page: LD `.knowledge/migration/m4-sqlite-read-layer.md`):**
  - **The reader-port "isomorphic seam + legacy-shape projection" generalized cleanly** from house's
    Firestore→SQLite to LD's Supabase→SQLite. LD's twist vs house: data was threaded through a
    *client-side stub* + a *web worker* search index, so the seam was **server endpoints** the browser
    fetches (`/api/dictionaries`, `/api/dictionaries/[id]/entries-data`) rather than only server loads —
    avoids SSR-ing a 2136-row catalog and keeps the existing client store/worker contracts. House should
    expect the same when a data path lives in a worker/store, not a load.
  - **adapter-node native-deps gotcha CONFIRMED end-to-end** (house's warning was exactly right): putting
    `better-sqlite3` in `dependencies` (+ `ssr.external` + `onlyBuiltDependencies`) yields `from
    'better-sqlite3'` + **0 `__filename`** in the server chunk. Cheap build-time check worth keeping.
  - **Seeding from already-local data:** `sqlite3 SRC "VACUUM INTO 'DEST'"` makes a clean single-file copy
    (folds the WAL, no `-wal`/`-shm` to chase) — nicer than the ATTACH+per-table copy when you want whole
    DBs. Watch for **partially-migrated local data** (LD: catalog complete but only 4/2136 per-dict dbs had
    content) — verify row counts before assuming a copied `.data` is whole.
  - **Keep an e2e regression dict unchanged by seeding its FIXTURES into SQLite** rather than re-pulling
    real data: when assertions are fixture-specific (LD's achi-flow), real migrated data wouldn't satisfy
    them; a tiny reproducible seed script (legacy→schema map: rename `*_by`→`*_by_user_id`, drop the old
    tenant FK, JSON-stringify, synth junction PKs, insert only existing columns) keeps the flow green.
  - **e2e error filtering:** assert `pageerror`/console-error emptiness but filter known-external noise
    (Mapbox tile 403s in headless, a still-attempted CDN-cache 403) so the gate reflects YOUR change.

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
- **HORSE-CLI** — ✅ DONE + **COMMITTED & LIVE** (`0d6acd8d`). Built the messaging fix: per-session
  **inbox** + **`horse send <project> <id> "msg"`** (`spawn`=new-only, `run`/`projects` cut, `status`→
  `list <id>`, `HORSE_DEFAULT_PROVIDER`). The updated `~/.claude/skills/horse-cli/SKILL.md` is the live
  reference — I use it as-is now. ⚠️ **Orchestrator-relevant constraint (still true):** inbox delivery is
  automatic only for sessions **Horse runs**; THIS orchestrator is a non-Horse interactive session, so a
  child's `horse send` to me **sits undelivered** → children must use the **file handoff** (ledger +
  issue), and Jacob relays "done". No longer tracked here as in-flight.
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
- **LD-M4** — ✅ DONE (`3747b3c9`). **M4 · SQLite read** complete in 4 commits on `vps-migration`
  (NOT pushed): `3452ad39` (predecessor docs) · `7c99b58a` (phase 0: port the example's
  `lib/db/server/*` + drizzle schemas/migrations + deps, dormant) · `0ad7873e` (phase A: catalog —
  globe/list/footer/detail read `shared.db`) · `b2b949d6` (phase B: entries worker reads per-dict
  `dictionaries/{id}.db` via a bundle endpoint). Decisions: **copy** the example's `.data` (catalog
  2136 dicts complete; **per-dict entries exist for only 4 of 2136** — torwali 9908 etc; achi=0);
  catalog via `/api/dictionaries` endpoint + a server layout load (NOT full-catalog SSR); entries via
  `/api/dictionaries/[id]/entries-data` feeding the Orama worker (dropped the `cached_data_table`/IDB
  paging); **achi-flow kept unchanged** by seeding the dummy fixtures into `achi.db`
  (`seed:achi-fixture`) since real Supabase repop needs the prod DB password + is a VPS-scale job and
  wouldn't keep the fixture-specific assertions anyway. Gate: check 0/15 · test 132 · build
  (better-sqlite3 external, 0 `__filename`) · `test:catalog` (220 public/949 private, real Torwali) ·
  `test:entries` (torwali 9908 from SQLite) · achi-flow 5/5 (13 fixtures from SQLite). 📘
  `.knowledge/migration/m4-sqlite-read-layer.md`. ⏳ Jacob eyeballs :3041 globe/list/maps + a dict's
  entries. **Deferred (own milestones):** M4-write (wa-sqlite+SharedWorker+sync), real auth (port
  house OTP/JWT — then admin list / my-dictionaries / writes leave the stub), media, R2.
- **LD-AUTH** — ✅ DONE (`6bc752ca`, project `living-dictionaries`; the 69-file tree is committed by
  **LD-WRITE** as its step 0).
  **M4 · real auth** shipped: FULL port of the example's `AuthUser`/`ssr_user`/`dict_roles` model
  (Jacob chose full port over a bridge) + `lib/admins.ts` + `/api/auth/*` + `/api/me/{dictionary-roles,
  dictionaries}`. `ssr_user` resolved from the session-cookie JWT in `+layout.server.ts`;
  `can_edit`/`is_manager` from REAL `dictionary_roles` (+ admin allow-list). 6 legacy write/media/email
  endpoints keep a real-JWT `locals.getSession` shim (`get-legacy-session.server.ts`) until M4-write.
  Gate: **check 0/15 · test 160 · build ✔ · achi-flow e2e PASS** (logged-out read-only → dev-OTP login
  as NON-admin `achi-manager@example.com` → `is_admin=false`/`admin_level=null` so can_edit is
  role-derived, not admin bypass → full editor flow → no pageerror). 📘
  `.knowledge/migration/m4-real-auth.md`.
  **LD↔house auth gotchas to cross-pollinate:**
  - ✅ **send-code rate-limit FIX carried** (house's in-memory per-email counter; the example DID still
    have the latent 429-unreachable bug). LD twist: LD's `email_codes.created_at` is NOT NULL w/ no
    default → the INSERT must supply `created_at` (house's omits it; house schema defaults).
  - 🆕 **Dev admin-level toggle for the allow-list world:** the old "Set Admin Role Level" button can't
    mutate an email-derived admin level, so re-established via a **dev-only `dev_admin_level` cookie**
    (`0|1|2`, honored only when `dev`) applied in a `resolve-admin-level.ts` helper used by get-user /
    verify-dict-role / +layout.server / the legacy getSession shim. Endpoint `/api/auth/dev-admin-level`
    (404 in prod). **House should mirror this** when it moves admin to an allow-list.
  - 🆕 **`can_edit` cold-cache bug** (likely latent in the example too, and relevant to house's
    client-cached role/entitlement stores): client `dict_roles` is fetched async, so the first
    authenticated load computed can_edit from an EMPTY cache → manager flashed read-only. Fix: AWAIT the
    role refresh in the root layout when the cache is cold (don't await inside the child layout — it
    races the root's in-flight `refresh()`).
  - 🆕 **e2e on a prod `node build`** can't use the `dev`-gated OTP-returns-code path → added an explicit
    env-gated `E2E_EXPOSE_OTP` escape hatch (never set in deploys). House's e2e likely runs against dev;
    if it ever tests `node build`, it needs the same.
  - Google client-id reused from the example (`215143435444-…`); graceful no-op if `PUBLIC_GOOGLE_
    OAUTH_CLIENT_ID` unset so email-OTP + e2e work without it (house pattern). jose hand-added to the
    lockfile (a plain install drifted picomatch).
- **HOUSE-NEXT** — ✅ DONE + committed (`18374ca2`, 5 commits on `repo-restructure`). **Customer reader
  now 100% Firestore-free:** intro page + series navigator + dr-house bio + Vimeo thumbnails all on SQLite
  (re-pulled 28 intros / 1 series / 8 series_items live from Firestore into `site/.data`; backfilled
  108/109 Vimeo thumbs; dr-house → static `bio.ts`). check 0 · test 147 · build clean · 0 Firestore /
  0 pageerrors. Editing + admin stayed inert. Knowledge appended to `firestore-to-sqlite-reader-port.md`
  (intro/series projections, live re-pull workflow, bare-import + migration-id gotchas for LD).
- **HOUSE-ADMIN** — ✅ DONE + committed (`0a9cfdc3`, 3 commits `ba69c33`/`df73167`/`3f20621` on
  `repo-restructure`). **Entire `/admin` surface is Firestore-free on the local-first wa-sqlite sync
  engine** ported from learn-from (wa-sqlite client + LiveDb + Sync + `/api/admin-sync`, `directory` +
  `messages` sectors), verified against REAL prod-backup data (1827 users · 373 subs · 285 threads · 590
  messages; FK-clean seed, dev session preserved). Shell/users/inbox/detail + sync dashboard (initial
  `0↑ 3089↓`) + a real SES send confirmed. check 0 · test 233 · build clean. 📘 **`.knowledge/architecture/
  firestore-to-sqlite-admin-port.md` = LD's M4-WRITE/sync playbook.** Deferred (missing /site deps, not
  design): Stripe reconcile, compose-new-email, attachments/R2, inbound ingest, rich-text reply.
  💡 **House→LD:** this is the wa-sqlite sync-engine port LD was waiting on → unblocks LD-WRITE.
- **LD-WRITE** — ✅ **P1–P4a DONE** (`e17570b6`, project `living-dictionaries`; 6 commits on
  `vps-migration`, NOT pushed: `e764c10c`+`7dae981f` = LD-AUTH step-0; `f6016bdf` P1 server ·
  `685126d4` P2 client engine · `098aa003` P3 feed-flip · `70334be9` P4a real writes). **M4 · write/
  sync:** browser **wa-sqlite** per-dict DB + **SharedWorker** + **bidirectional sync** (ported the
  example's `dict-client/*` + `client/{connection,live}` near-verbatim; server `dictionary-sync-helpers`
  + `/api/dictionary/[id]/{changes,db}`; `wa-sqlite@^1.0.0` lockfile-faithful). **LD design (Jacob):**
  wa-sqlite = client source of truth; **Orama fed FROM wa-sqlite** (entries-data endpoint + CDN
  fast-path RETIRED); saves → wa-sqlite. Editor edits now **persist to real server SQLite + round-trip**
  (verified: NEW `e2e/dict-sync.mjs` — edit → server `.data/dictionaries/achi.db` updates + a fresh
  no-OPFS context reads it; achi-flow PASS with a reload-persistence assertion). Gate: check 0/15 ·
  test 178 · build. 📘 `.knowledge/migration/m4-write-sync.md`.
  **P4b REMAINING:** replace the interim `api.X` Orama double-write with a watcher so **Orama watches
  wa-sqlite** (one path for local edits + remote sync-pulls) — Jacob's watermark-delta design; the hard
  part is row→entry_id resolution across ~16 tables (design in `.issues/m4-write-sync.md`).
  **LD↔house sync-engine gotchas (cross-pollinate — these bite house's wa-sqlite engine too):**
  - 🆕🐞 **`INSERT OR REPLACE` in a trigger fired by an UPSERT → `UNIQUE constraint failed`.** The
    `last_modified_at` bump triggers used `INSERT OR REPLACE INTO db_metadata`; the sync engine's
    `merge_dict_row`/`#upsert_row` write via `INSERT … ON CONFLICT(id) DO UPDATE`, and under
    `defer_foreign_keys=ON` the outer upsert's conflict policy clashes with the trigger's OR REPLACE →
    every editor push to an existing row 500s. **Both the example AND house's learn-from engine have
    this latent** (only surfaces on a real push to a row whose table has an OR-REPLACE trigger). Fix:
    rewrite the trigger as `INSERT … ON CONFLICT(key) DO UPDATE`. **House should audit its bump/`updated_at`
    triggers.**
  - 🆕🐞 **`/changes` (and admin-sync) fast-bail drops editor pushes.** The "nothing changed since
    cursor" early-return ran before processing dirty rows; the client cursor usually EQUALS the server
    watermark, so the editor's next push hit `last_modified_at <= synced_up_to` and returned empty —
    rows never merged. Fix: skip the fast-bail when the caller has dirty rows/tombstones to push.
    **House's `process_sync` likely has the same guard — check it.**
  - 🆕 **OPFS works in a dedicated Worker but NOT inside the SharedWorker** (headless Chromium 148) →
    falls back to MemoryVFS. Fine: sync-from-null backfills, and persistence rides the POST (verify by
    reading the server db + a fresh no-OPFS context, not just a reload — a reload can be satisfied by
    local OPFS). SharedWorker `fetch`/`console` don't surface on puppeteer `page.on(...)` — debug by
    writing state into `db_metadata` from `sync_once` + logging server-side.
  - 🆕 **New migration to fix shipped triggers:** don't edit the immutable initial migration; add a new
    `*.sql` (drops+recreates the triggers). `run_sql_migrations` runs on every db open → existing
    server dbs + client snapshots pick it up; `LATEST_DICT_MIGRATION` advances on both sides so the
    handshake stays matched. Make seed scripts run migrations from disk (tsx has no `import.meta.glob`).
- **HOUSE-EDIT** — 🔶 spawned `eacecdd8` (project `house`). Tree clean. PLAN + interview Jacob on the
  next milestone, recommending **(A) library editing on SQLite** (now unblocked by reader-SQLite + the
  admin sync engine) over (B) local search / (C) admin deferred follow-ups / (D) deploy-prep. Carries
  LD's `dev_admin_level` + `E2E_EXPOSE_OTP` patterns for house to mirror.

> **Commit policy (Jacob 2026-06-04):** each repo's NEXT spawned session commits its predecessor's
> uncommitted tree first (LD-M4 does this). HOUSE-NEXT + horse are now committed. **Same-repo
> serialization holds:** never spawn a 2nd agent into a tree while the prior one is still
> committing/working (HOUSE-NEXT had to finish its commit + go idle before HOUSE-ADMIN was spawned).

Each sub-session reports its result back here; I fold gotchas/decisions into the ledger above and
cross-pollinate to the other project.

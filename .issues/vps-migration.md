# vps-migration — incrementally evolve `main` toward the SQLite/VPS/Svelte-5 site

The master plan for the `vps-migration` branch. We are evolving the **live, working**
Living Dictionaries app (`main`) in small, individually-verifiable steps — never a big-bang
rewrite. The previous attempt (`svelte-5-migration`, now preserved as the
`living-dictionaries-example` repo) fused "rebuild in Svelte 5 + new SQLite DB + port every
route" into one leap; broken/missing features became unbisectable. This time each change is
one isolated thing behind a checkpoint.

## Two repos

| Repo | Role | Branch |
|---|---|---|
| `~/code/living-dictionaries` | **improve** (this repo) | `vps-migration` (off fresh `main`) |
| `~/code/living-dictionaries-example` | **learn from** (read-only reference) | `svelte-5-migration` |

The example is the finished destination: top-level `site/`, Svelte 5, plain CSS + universal
icons, better-sqlite3 server + wa-sqlite browser + sync engine + R2 snapshots, own
JWT/Google/OTP auth, Docker→VPS deploy, a tested Supabase→SQLite migration script, and real
migrated `.data`. We **peek across the fence** to learn patterns and copy self-contained
modules later — but we do NOT pull its full auth/db in early. Early stubs stay trivial.

## Standing principles

1. **One thing at a time, always runnable.** Every milestone leaves the app building +
   booting. If something looks different, it should be obvious which single change caused it.
2. **Stub before port.** Cut Supabase out with hand-wave auth + dummy data first. Real
   systems return one at a time, much later (M4+), each behind its own checkpoint.
3. **Keep stubs dead-simple.** Just enough dummy data, in the *existing data shapes*, for
   every route to render. Peek at the example's mocks to learn the simplest dummy approach;
   don't reproduce its real infrastructure.
4. **Don't touch component styles.** The site must look identical through the whole branch.
   UnoCSS utility classes stay exactly as written; only the build plugin changes (M2).
5. **Source code is the source of truth.** `.knowledge` records only decisions/gotchas, not
   what a file already says.
6. **Verify every step.** `pnpm --filter=site build` + `check` + `test` green; visual parity
   where possible (Jacob runs the dev server on :3041 and eyeballs).

## Milestones

### M0 · Relocate `packages/site` → top-level `site/` ✅ DONE
Pure structural move to match example/house/tutor layout. No behavior change.
- [x] `mv packages/site site` (filesystem move; removed moved `node_modules`/`.svelte-kit`/`build` so pnpm relinks)
- [x] `pnpm-workspace.yaml`: added `site` (site no longer matched by `packages/*`)
- [x] Fixed root refs to `packages/site`: `vitest.workspace.ts`, `.vscode/settings.json` (i18n locales + `unocss.root`), `.github/workflows/component-tests.yml` (`PROJECT_ROOT`), `site/kitbook.config.ts` (githubURL)
- [x] `pnpm-lock.yaml` repathed faithfully (see gotcha below); `--filter=site` resolves to `site/`
- [x] **Verify:** `check` = 0 errors (62 warnings, baseline) · `test` = 123 pass (30 files) · `vite build` compiles cleanly

**M0 gotchas / decisions (record):**
- **Lockfile fidelity > convenience.** A plain `pnpm install` (non-frozen) under pnpm v10.33
  re-resolved deps (e.g. `typescript` 5.1.6→5.7.2, ~600 lockfile lines) and introduced a
  **1 `check` error** (UnoCSS vs sveltekit vite-plugin type clash from a dual `@types/node`
  18/22 split). A pristine-`main` worktree with `--frozen-lockfile` = **0 errors**, proving
  it was install-induced, not pre-existing. Fix: restore committed `pnpm-lock.yaml` and edit
  ONLY the moved importer — 3 lines: `packages/site:`→`site:`, site's
  `link:../types`→`link:../packages/types`, and scripts' dep `link:../site`→`link:../../site`
  — then `pnpm install --frozen-lockfile`. **Always honor the committed lockfile for
  structural moves; never let install drift versions.**
- **Build "failure" is environmental, not the move.** `vite build` compiles 100%; only the
  `adapter-vercel` post-step rejects local **Node v24** (wants 18/20). Same on pristine main.
  Moot after M3 (adapter-node).
- **Tracked `.env` files:** `main` commits `site/.env` + `site/.env.development` (public
  Supabase config). The `mv` preserved them physically (build read them). ⚠ On commit, the
  sandbox can't run `.env`-referencing git commands; if `site/.gitignore` ignores `.env`,
  `git add -A` will drop them — `git add -f site/.env site/.env.development` to keep parity
  (they become irrelevant after M1 strips Supabase anyway).

### M0.5 · Swap `adapter-vercel` → `adapter-node` ✅ DONE
Done early (Jacob: "switch as soon as makes sense") because `adapter-vercel` rejects local
Node 24 — blocking every local `build`/boot we need to verify M1/M2. adapter-node unblocks
`pnpm build` → `node build` → boots.
- [x] `site/package.json`: `@sveltejs/adapter-vercel` → `@sveltejs/adapter-node@^5.2.12` (resolves 5.5.4)
- [x] `site/svelte.config.js`: adapter import
- [x] **Verify:** `build` → adapter-node output (`build/{index,handler}.js`) → `node build` logs `Listening on http://0.0.0.0:PORT` · `check` 0 errors · `test` 123 pass

**M0.5 gotchas (the swap cascaded — all fixed, all in `.knowledge/migration/`):**
- **adapter-node@5.5.4 forces `rollup ^4.59`** (4.24.3→4.61.0). Can't pin rollup back. The
  example runs the same combo fine, so the bump itself is OK — but it exposed two latent
  issues main had been hiding behind adapter-vercel:
- **adapter-node externalizes `dependencies`, BUNDLES `devDependencies`.** main had NO
  `dependencies` block — everything in devDeps — so adapter-node tried to bundle
  `@resvg/resvg-js`'s native `.node` (used by `/og`) → rollup parse error. Fix: moved the og
  trio (`@resvg/resvg-js`, `satori`, `satori-html`) into a new `dependencies` block (matches
  the example, which buckets all runtime deps there). ⚠ M3 (Docker prod install) will need a
  full deps/devDeps audit so every runtime import is in `dependencies`.
- **Dual `@types/node` (18 + 22) → dual `vite` types → `check` error** in `vite.config.ts:11`
  (UnoCSS plugin vs sveltekit plugin). Fixed with root `pnpm.overrides: { "@types/node":
  "22.8.6" }` (collapses to one vite type). Temporary anyway — UnoCSS svelte-scoped leaves in M2a.

### M1 · Stub auth + stub db → remove the Supabase dependency ✅ DONE
A simple app that boots with **zero Supabase**, looks the same, teeny dummy data, hand-wave
(logged-out) auth. Verified by production `node build` boot + curl (localhost HTTP works for
the prod server, unlike the dev server). Jacob still eyeballs live UI/maps at :3041.
- [x] **Fake client at the two chokepoints.** New `src/lib/supabase/stub-client.ts` — a tiny
      in-memory query engine (`from(table)` → chainable builder honoring `eq/neq/is/in/gt/not`,
      thenable, `.single()`; no-op auth = logged-out; no-op realtime/storage). `getSupabase()`
      (`index.ts`) + `getAdminSupabaseClient()` (`admin.ts`) + the search worker
      (`entry.worker.ts`, was its own `createClient`) all return it. One stub, ~all call sites
      untouched. Delete this file at M4.
- [x] **Dummy data:** `src/lib/mocks/dummy-dictionaries.ts` — 12 `DictionaryView` rows (legacy
      `coordinates.points[…]` shape). Stub serves them for the `*dictionaries_view*` tables;
      everything else → `[]`. Added a global `dictionaries` store
      (`create_dictionaries_store` in `dictionaries.ts`, wired into root `+layout.ts`) — it's
      read via `$page.data.dictionaries` by `Footer` + `/dictionaries` but nothing provided it.
- [x] **Auth = logged-out hand-wave.** No tokens → `getSession` returns null; sign-in attempts
      toast "stubbed". (A dummy logged-in user can be added later if a route needs it.)
- [x] **Supabase env removed.** No `$env/static` Supabase imports remain in app code
      (`index.ts`, `admin.ts`, `search/entries-ui-store.ts` cleaned; `mode` now from
      `import.meta.env.MODE`). App no longer needs `PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY`.
- [x] **Adapter-node SSR fix (M0.5 fallout, fixed here):** `kitbook` was imported for value
      (not just type) in `SeoMetaTags.svelte` (every page!), `/og`, `LoadOgImage` — dragging
      `typescript` into the ESM server bundle → `__filename is not defined` → 500 on every SSR
      page in the prod build (dev was fine). Replaced with a vendored `src/lib/lz/lz-string.ts`
      (copied from the example; eslint-ignored). All other `kitbook` imports are `import type`
      (erased) or in `.variants.ts`/`.stories` (not in the prod route graph).
- [x] **Verify:** `node build` boots, no Supabase; `/`, `/dictionaries`, `/<dict>` (+entries/
      about/contributors/settings), `/admin`, `/account`, `/about`, `/tutorials`,
      `/create-dictionary` all → **HTTP 200**, clean server log. `check` 0 errors · `test` 123
      pass · `lint` clean.
- [ ] **Jacob:** eyeball at :3041 (globe + dummy dictionary points render client-side; chrome
      looks the same logged-out). `pnpm dev` no longer needs Supabase.

### M2 · Convert to Svelte 5, component by component ⭐ (the centerpiece)
The site looks identical throughout. Sub-steps isolate the toolchain change from the syntax change.
- [x] **M2a · UnoCSS plugin swap (still Svelte 4).** ✅ DONE — report:
      `.issues/subagent-reports/m2a-unocss-plugin-swap.md`. Replaced `@unocss/svelte-scoped/vite`
      with universal `unocss/vite` (`UnoCSS()`, no `injectReset`). Global styles now imported in
      root `+layout.svelte`: `./reset.css` (layered reset, see fix 3) → `virtual:uno.css` → `./global.css`.
      Removed the svelte-scoped placeholder (`%unocss-svelte-scoped.global%` in `app.html` +
      `transformPageChunk` in `hooks.server.ts`). `uno.config.ts` presets unchanged; `i-*` icons
      + all utility classes compile identically. Deps: dropped `@unocss/svelte-scoped`, added
      `@unocss/reset` as a direct devDep (it was transitive; pnpm's isolated node_modules wouldn't
      expose it to the app's direct import). Lockfile hand-edited (net diff = those 2 lines only,
      zero version drift); `--frozen-lockfile` clean.
      **Verify:** check 0 errors/62 warn · test 123 pass · eslint clean · build ✔ · `node build`
      boot → `/`, `/dictionaries`, `/about`, `/achi` all **200**, log clean; served CSS contains
      the tailwind reset, utilities (`.flex`/`.rounded-md`/`.text-gray-800`), and `i-*` icons.
      **Post-review fixes (Jacob caught drift):** the universal plugin doesn't do two things
      svelte-scoped did by default — both fixed in `uno.config.ts` (no component edits):
      (1) `transformers: [transformerDirectives()]` — restores `--at-apply`/`@apply` in `<style>`
      blocks (broke the dictionary **side menu**, EditField, +12 files);
      (2) a custom `extractors` entry that reads Svelte `class:utility={…}` directives — restores
      utilities applied only that way (the **entry title** `class:text-4xl`, and the entry-overlay
      **modal content** which uses `class:order-2`/`class:pt-1`/`class:!-top-6`). Core re-adds the
      default extractor automatically, so plain `class="…"` is unaffected.
      (3) **Modal grey overlay** was an unstable equal-specificity cascade tie — reset
      `[type=button]{background:transparent}` (0,1,0) vs svelte-pieces backdrop `.sp-8i1hz2{#000}`
      (0,1,0), resolved by non-deterministic dev load order → transparent on long-running :3041.
      Fixed by loading the reset in a CSS cascade layer (new `src/routes/reset.css`:
      `@import '@unocss/reset/tailwind.css' layer(reset)`, imported by `+layout.svelte`), so unlayered
      author/utility styles always win — robust app-wide, dev + prod. Diagnosed/verified with a
      headless browser against `node build` + a throwaway `vite dev` (both sandbox-reachable, unlike
      :3041). Swept for other instances: all `--at-apply` (transformer) + all 30 `class:` utilities
      present, no variant-groups, no `.css` `@apply`.
      ⏳ **Jacob:** restart :3041 + hard-refresh, eyeball light-mode parity (side menu, entry title
      size, modal grey overlay) before M2b.
- [x] **M2b · Bump to Svelte 5 (compatibility mode).** ✅ DONE — report
      `.issues/m2b-svelte5-modernize.md`. Latest toolchain (svelte 5.56, vite 8, plugin 7.1, kit
      2.62, check 4.5, vitest 4.1, ts 5.9, unocss 66), vendored svelte-pieces, kitbook→svelte-look,
      mock manager + dummy entries, puppeteer-core deep-flow. Committed as `6aa75c16`.
- [x] **M2c · Migrate syntax to runes.** ✅ DONE — report `.issues/m2c-runes-migration.md`. Ran the
      runes codemod via a per-file Node driver (the interactive CLI hangs in non-TTY) over 367 files
      (excl. vendored svelte-pieces), hand-fixed the fallout (MediaStream `@migration-task`,
      `ComponentProps<typeof X>`, `$page.`→`page.` markup, email `svelte/server` render port,
      Slideover→runes, `<th>`→`<tr>` wraps). Warnings 484 → **15** via
      `compilerOptions.warningFilter`. Adopted the shared `browser-launch.mjs`.
- [x] **Verify:** ✅ check 0 errors / 15 warnings · test 123 pass · build + `node build` boot ·
      achi-flow 5/5 · 19 routes + editor + table headless load = 0 real errors. Visual parity
      eyeballed via headless screenshot (list view identical). ⏳ Jacob: eyeball maps/visual at :3041.

### M3 · Deploy the stubbed Svelte-5 app
Prove the pipeline on a trivial, can't-really-break app.
> **Deploy path decided (Jacob 2026-06-04):** an existing **GitHub Actions workflow auto-deploys
> pushed code to `new.livingdictionaries.app`** — we do NOT hand-roll a `vps-setup` sync or a
> `staging.*` subdomain. The workflow currently targets a different branch; Jacob **re-aims it to
> `vps-migration` at the very END** to exercise the deploy. So M3's job is to make the build
> deploy-ready; the push-to-deploy itself is the final step, saved for last.
- [x] `adapter-node` (done back in M0.5).
- [ ] Confirm the existing CI workflow's build/deploy steps suit the stubbed app (Docker/compose if it
      uses them; better-sqlite3 native build only matters at M4 — keep minimal now).
- [ ] **(LAST) Jacob re-aims the deploy workflow's branch → `vps-migration`**, pushes, verifies the
      stubbed app boots + renders at `new.livingdictionaries.app`.

### M4+ · Reintroduce real systems, one at a time
Each is its own milestone with a checkpoint. Order TBD, rough sequence:
- [x] SQLite **read** layer ✅ DONE (`.issues/m4-sqlite-read.md`; commits `7c99b58a`/`0ad7873e`/`b2b949d6`).
      Server better-sqlite3 `shared.db` (catalog: globe/list/detail) + per-dict `dictionaries/{id}.db`
      (entries worker via a bundle endpoint). Copied the example's `lib/db/server/*` + drizzle schemas/
      migrations; seeded `.data` from the example (catalog 2136 dicts; real entries for torwali + the 3
      other populated dicts; achi seeded with dev fixtures via `seed:achi-fixture`). `better-sqlite3` in
      `dependencies` (adapter-node gotcha). Writes/auth-gated reads stay on the stub until M4-write/auth.
- [~] SQLite **write** path + sync engine (wa-sqlite browser, SharedWorker dict.db, `/changes`) —
      **P1–P4a DONE** (`.issues/m4-write-sync.md`; 📘 `.knowledge/migration/m4-write-sync.md`; commits
      `f6016bdf`/`685126d4`/`098aa003`/`70334be9` on `vps-migration`, not pushed). Browser wa-sqlite
      per-dict DB + SharedWorker + bidirectional sync; Orama now fed from wa-sqlite (entries-data
      endpoint retired); editor edits PERSIST to real server SQLite + round-trip (verified via
      `e2e/dict-sync.mjs` + achi-flow reload assertion). Fixed two latent example bugs (lmod trigger
      `OR REPLACE`-under-upsert; `/changes` fast-bail dropping editor pushes). **P4b remaining:**
      replace the interim `api.X` double-write with a watcher so Orama watches wa-sqlite (handles
      remote sync-pulls too) — the watermark-delta + row→entry_id-resolution design is in the issue.
- [x] Real auth (JWT + Google + email-OTP) ✅ DONE (`.issues/m4-real-auth.md`;
      📘 `.knowledge/migration/m4-real-auth.md`). Full port of the example's `AuthUser`/`ssr_user`/
      `dict_roles` model: `lib/auth/*` + `lib/admins.ts` + `/api/auth/*` + `/api/me/*`; `ssr_user`
      from the session-cookie JWT; `can_edit`/`is_manager` from real `dictionary_roles`. send-code
      rate-limit FIX carried from house. Dev `dev_admin_level` cookie replaces the old admin toggle.
      6 legacy write/media endpoints keep a real-JWT `getSession` shim until M4-write. check 0/15 ·
      test 160 · build ✔ · achi-flow reworked to real dev-OTP login (non-admin manager).
- [ ] Media upload (legacy GCS bucket, presigned PUT).
- [ ] R2 snapshot builder + cron.
- [ ] Then the legacy cutover runbook (DNS, catch-up migration) — far future.

## Reuse pointers (where to peek in the example)
- Dummy/stub patterns: `site/src/lib/mocks/` (keep ours simpler).
- Server SQLite: `site/src/lib/db/server/{shared-db,dictionary-db,get-dictionary}.ts`.
- Schemas: `site/src/lib/db/schemas/{shared,dictionary}.ts` (+ migrations dirs).
- Sync engine: `site/src/lib/db/sync/*`.
- Deploy: `Dockerfile`, `docker-compose.yml`.
- Migration script: `packages/scripts/migrate-to-sqlite/`.
- Knowledge: `.knowledge/architecture/*` (db-sync, supabase→sqlite migration, dictionary-routes).

## Decisions (from interview, 2026-06-03)
- Strategy: transform `main` in place; example is reference/parts-bin, not the base.
- Svelte 5 is the centerpiece, done on the stubbed app so it's pure syntax.
- Keep UnoCSS classes; switch svelte-scoped → universal `unocss/vite` plugin in M2a.
- First VPS deploy = M3 (after Svelte 5), on the stubbed app.
- Bring trimmed/adapted agent scaffolding now, reflecting the Svelte-4/stub reality.

## Open / to-confirm later
- UnoCSS universal plugin: exact config for the `i-*` icon classes + presets parity (M2a research).
- `--filter=site` resolution after the move (verify in M0).
- VPS subdomain name for the staging deploy (M3).

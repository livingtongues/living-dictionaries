# Vitest fix + safe package bumps + TS6 + homegrown logging

Branch: `svelte-5-migration`. Tracks the cleanup the user asked for after the package/vitest audit.

## 1. Master plan + stale refs ✅/⬜
- ⬜ `.issues/cross-project-orchestration.md`: `vps-migration` → `svelte-5-migration`; fix M3 cutover step that says "flip DEPLOY_BRANCH" (already on svelte-5-migration).
- ✅ AGENTS.md already rewritten in prior step.

## 2. Vitest fix ⬜
- ⬜ Delete root `vitest.workspace.ts` (imports `defineWorkspace`, gone in vitest 4; v4 ignores the file → root `vitest` globs whole repo, 25 failed suites).
- ⬜ Root `package.json`: `"test": "vitest"` → `"test": "pnpm --filter=site test"`.
- Orphan note: `scripts/`, `types/`, `ids-import/` each still have a `vitest.config.ts` but aren't in the pnpm workspace (only `site`). Harmless on disk; their tests only run if that package is installed standalone. NOT deleting them.

## 3. Homegrown logging (replace 3rd-party) ⬜
Port the client→server log pipeline from `living-dictionaries-example` (LD's own end-state — drops in clean; current LD already has `client_logs` table, `shared-db.ts`, `post_request`, `$api` alias, `verify_jwt`, `ResponseCodes`).
Create:
- ⬜ `site/src/lib/server/insert-client-log.ts`
- ⬜ `site/src/routes/api/log/_call.ts`
- ⬜ `site/src/routes/api/log/+server.ts`
- ⬜ `site/src/routes/api/log/server.test.ts`
- ⬜ `site/src/lib/debug/remote-log.ts`
Wire/remove:
- ⬜ `site/src/routes/+layout.svelte`: drop `<Analytics />`, add `onMount(() => init_remote_logging())`.
- ⬜ Delete `site/src/routes/Analytics.svelte`, `site/src/lib/components/shell/LogRocket.svelte`, `site/src/lib/webvitals.ts`.
- ⬜ `site/src/routes/+error.svelte`: remove `@sentry/browser` capture (keep error UI).
- ⬜ `site/src/app.html`: drop commented sentry script.
- ⬜ `site/vite.config.ts`: drop dead `REPLACED_WITH_VERCEL_ANALYTICS_ID` branch in `getReplacements()`.

## 4. Packages ⬜
- ⬜ Remove from `site` devDeps: `@sentry/browser`, `logrocket`, `web-vitals`.
- ⬜ Bump `site` (align w/ house + safe-same-major): `@sveltejs/kit`→^2.63.0, `svelte`→^5.56.2, `svelte-check`→^4.6.0, `@orama/orama`→3.1.18, `drizzle-orm`→^0.45.2, `@iconify/json`→^2.2.483, `@aws-sdk/*`→^3.1062.0, `comlink`→^4.4.2, `@types/google-one-tap`→^1.2.7, `tslib`→^2.8.1, `@tiptap/*`→^3.26.0, `jszip`→^3.10.1, `csvtojson`→^2.0.14, `d3-geo`→^3.1.1, `idb-keyval`→^6.2.5, `xss`→^1.0.15, `@types/d3-dsv`→^3.0.7, `@types/file-saver`→^2.0.7, `@types/geojson`→^7946.0.16, `@types/recordrtc`→^5.6.15.
- ⬜ TS6: `typescript`→^6.0.3 (site + root). Ensure `strict: false` (add explicitly to site/tsconfig.json).
- ⬜ Root devDeps align w/ house: `eslint`→^10.4.1, `typescript-eslint`+`@typescript-eslint/eslint-plugin`→^8.60.1, `@vitest/eslint-plugin`→^1.6.19, `eslint-plugin-svelte`→^3.19.0, `svelte-eslint-parser`→^1.8.0, `eslint-plugin-jsonc`→^3.2.0, `svelte`→^5.56.2.
- Lockfile fidelity: confirm `pnpm install --frozen-lockfile` passes first; after edits run install; inspect `git diff --stat pnpm-lock.yaml` for unintended drift.

## 5. Verify ⬜
- ⬜ `pnpm --filter=site check` → 0 errors
- ⬜ `pnpm --filter=site test --run` → green
- ⬜ `pnpm lint:fix` changed files
- ⬜ `pnpm --filter=site build` + `node build` boot + curl `/`

## Gotchas / context
- Multiple agent sessions in this tree — re-read package.json right before editing (a concurrent session is touching pnpm-workspace/onlyBuiltDependencies).
- l-d-example log files use `Symbol.for('living:client-log-rate-buckets')` and `const { describe, test, expect } = import.meta.vitest` — copy verbatim.

## STATUS: COMPLETE ✅
All five phases done + verified. (Package phase: the concurrent pnpm-workspace session finished first, so the "deferred" worry cleared — `onlyBuiltDependencies`/`overrides` now live in `pnpm-workspace.yaml`; frozen install was consistent before I bumped.)

Verification:
- `pnpm --filter=site check` → **0 errors / 19 warnings** (under TS 6).
- `pnpm --filter=site test --run` → **356 passed / 60 files**.
- `pnpm lint` (new eslint stack) on changed files → clean.
- `pnpm --filter=site build` → ok; `node build` boots; `GET /` → 200; `POST /api/log` → `{ok:true,accepted:1}`; row confirmed in `shared.db.client_logs` (then cleaned).
- Lockfile diff net **−1350 lines** = the removed `@sentry/browser`/`logrocket`/`web-vitals` transitive trees; no unrelated drift.

TS6 breaking change hit: import **assertions** removed → changed `assert { type: 'json' }` to `with { type: 'json' }` in `src/lib/i18n/index.ts` (only file affected).
Orama 3.0.1→3.1.18 added an empty `pinning.rules: []` to the serialized index → updated the inline snapshot in `search-entries.test.ts` (tokens unchanged).

Held back (out of "safe" scope, flagged to Jacob): `@turf/*` 6→7, `wavesurfer.js` 5→7, `satori` 0.0.44→0.26, `@resvg/resvg-js`, deprecated `@types/mapbox-gl` + `@types/ckeditor__ckeditor5-core`.
Left intentionally: historical `// vps-migration M4 …` milestone comments in `src/lib/search/*`, `db/*`, `mode.ts`, `+layout.ts` (not current-branch assertions; editing risks colliding with the active schema session). `.issues/supabase-removal.md` branch line left too (that session is working from it).

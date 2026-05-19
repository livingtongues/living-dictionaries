# Rename `packages/site` → `packages/old-site`, then `new-site` → `/site`

Goal: top-level `/site` becomes the active SvelteKit web app, matching `house/site` and the post-rename `tutor/site`. The legacy `packages/site` lives on as `packages/old-site` for ongoing reference / data scripts.

Currently on branch `svelte-5-migration`, which is also the living VPS deploy branch — so the rename + Dockerfile update will trigger an auto-deploy on push.

> User has explicitly said: don't worry about breaking production, just get it done.

## Two-phase rename order

Phase 1 — `packages/site` → `packages/old-site` (so the name `site` is free).
Phase 2 — `new-site` → top-level `/site`.

If we do Phase 2 first, the workspace would briefly have two `@living-dictionaries/site` packages (the old one and the renamed new one) — pnpm refuses. Phase 1 first.

---

## Phase 1 — `packages/site` → `packages/old-site`

### Files to touch

- `git mv packages/site packages/old-site`.
- `packages/old-site/package.json` `"name": "@living-dictionaries/site"` → `"name": "@living-dictionaries/old-site"`.
- `packages/scripts/package.json` devDeps `"@living-dictionaries/site": "workspace:^0.0.1"` → `"@living-dictionaries/old-site": "workspace:^0.0.1"`.
- `packages/scripts/download-audio.ts` import: `'@living-dictionaries/site/src/routes/[dictionaryId]/export/friendlyName'` → `'@living-dictionaries/old-site/...'`.
- `packages/scripts/import/row.type.ts` import: `'@living-dictionaries/site/src/lib/glosses/glossing-languages'` → `'@living-dictionaries/old-site/...'`.
- `.vscode/settings.json`: `i18n-ally.localesPaths` `packages/site/...` → `packages/old-site/...`; `unocss.root: "packages/site"` → `"packages/old-site"` (this will get re-pointed again in Phase 2 to `"site"`).
- `.github/workflows/component-tests.yml`: `PROJECT_ROOT: ./packages/site` → `./packages/old-site`. (Or delete the workflow if it's no longer used — verify first.)
- `packages/old-site/kitbook.config.ts`: `githubURL: 'https://github.com/livingtongues/living-dictionaries/tree/main/packages/site'` → `.../packages/old-site`.
- Root `package.json` scripts: `test:db`, `test:site`, `test:e2e`, `reset-db` all use `pnpm --filter=site …` — these run against the OLD site. Either retarget to `old-site` (`pnpm --filter=old-site …`) or, since we're keeping the old code dormant, drop them entirely. **Pick**: rename to `old-site` so the scripts keep working for any one-off data-side run. We can also add `test:db:old`, `test:site:old`, etc. once the new `/site` matures.
- `.issues/future/*.md` — many references to `packages/site/...` (admin-sync-dashboard, canvas-globe-home-page, dictionary-delete-cascade-fk-error, dictionary-pglite-tracer-bullet, refactor-delete-dictionary-to-script, deploy-new-site-to-living-vps, etc.). Mechanical sweep — `packages/site/` → `packages/old-site/`.
- `packages/old-site/src/docs/data/new-entry-field-creation.md`, `packages/old-site/src/docs/misc/i18n.md`, `packages/old-site/src/docs/Supabase.md` — internal docs that mention `packages/site/...`. Optional but cheap.

### Run

- `pnpm install` from repo root. Verify pnpm picks up the renamed workspace package.
- `pnpm --filter=old-site check` (renamed script — sanity that the old site still type-checks).

---

## Phase 2 — `new-site` → `/site`

### Files to touch

- `git mv new-site site`.
- `site/package.json` `"name": "@living-dictionaries/new-site"` → `"name": "@living-dictionaries/site"`.
- `pnpm-workspace.yaml`: `- new-site` → `- site`.
- Root `package.json` scripts: every `pnpm --filter=new-site …` → `pnpm --filter=site …`. Specifically: `dev`, `prod`, `build`, `preview`, `check`, `check:watch`, `test:new` (rename to `test:site` once `test:site` for the old one is renamed to `test:site:old` per Phase 1's pick).
- `Dockerfile`: every `new-site` → `site` (both builder + runner stages, including `pnpm --filter @living-dictionaries/new-site build` → `pnpm --filter @living-dictionaries/site build`).
- `.vscode/settings.json`: `unocss.root: "packages/old-site"` (from Phase 1) → `"site"`.
- `.issues/future/deploy-new-site-to-living-vps.md` — references throughout. Either delete (the work is now done / superseded by this issue) or update mechanically. Recommend delete after confirming it's all captured here.
- `.issues/future/sync-live-pglite-improvements-from-tutor.md` and similar — sweep for `new-site` references.
- `new-site/svelte.config.js`, `new-site/vite.config.ts`, `new-site/uno.config.ts`, `new-site/svelte-look.config.ts`, `new-site/README.md` — paths inside don't reference the folder name, just normal aliases. No changes expected.
- `AGENTS.md` (LD's) — sweep for `new-site` / `packages/site` and rewrite as `/site` / `packages/old-site`.

### Run

- `rm -rf node_modules new-site/node_modules packages/old-site/node_modules` then `pnpm install`.
- `pnpm dev` from repo root — confirm new-site (now `/site`) boots.
- `pnpm check` — svelte-check passes.
- `pnpm test:all` — full workspace test suite.
- `docker compose build && docker compose up` locally — confirm the renamed Dockerfile path still builds.

---

## After both phases

- Push to `svelte-5-migration` — VPS webhook will trigger deploy. Watch deploy logs.
- Verify `new.livingdictionaries.app` still serves the hello-world.
- Knowledge dump goes into `.knowledge/` if any sharp edges surface.

## Risks / open questions

- The root `package.json` `test:db`, `test:e2e` scripts target the OLD packages/site. After rename to `old-site`, the npm-script names also need updating if we want to keep them working. Pick documented above.
- `packages/scripts` cross-imports from `@living-dictionaries/old-site` — verify the two specific files (`download-audio.ts`, `import/row.type.ts`) actually still execute in real workflows. If they're dead code, we can drop them rather than keep the dep edge.

## Lessons learned

- (Add as we go.)

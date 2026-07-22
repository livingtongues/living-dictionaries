# Rename `zh` → `zh-CN` (简体中文) + add `zh-TW` (繁體中文), AI-fill Traditional

Align LD's Chinese UI locales with tutor: rename the existing `zh` (中文) locale to
`zh-CN` labeled **简体中文**, and add a new `zh-TW` locale labeled **繁體中文**. Fill every
`zh-TW` string by converting the existing human-reviewed Simplified set to Traditional using
**Taiwan (zh-TW) vocabulary conventions** (OpenCC `s2twp`: 軟體/影片/資訊/預設/檔案/使用者…),
not just character swaps. New rows flagged `source='ai', needs_review='ai'` per the
fill-translations policy.

## Key facts (researched)
- Locale is **cookie/query-based**, NOT path-based — no `/zh/...` routes. Resolved in
  `+layout.ts`: `?lang=` → `locale` cookie → `accept-language`. **No URL/route changes needed.**
- `getSupportedLocale` currently matches via `userLocale.includes(supportedLocale)` — BROKEN with
  two `zh*` variants (`'zh-Hant'.includes('zh')`). Ported tutor's exact-match + alias table.
  **LD divergence from tutor:** bare `zh` maps to **`zh-CN`** (Simplified), not `zh-TW` — to
  preserve legacy `zh`-cookie users' Simplified experience.
- `scripts/fetch-baked-i18n.mjs` validates locale filenames with `\w+` which REJECTS a hyphen →
  the whole i18n bake would silently throw and ship stale files. Fixed to `[\w-]+`. **Critical.**
- Committed `locales/**` files are SEEDS; the deploy bake overwrites them from the prod DB export
  (`TRANSLATABLE_LOCALES` × keys, misses → `''`). So the **prod `shared.db` is the real source of
  truth** — a file-only fill gets blanked on the next deploy. zh-TW rows MUST land in prod DB.
- `i18n_translations` + `translator_languages` are **server-only** (never synced). Enum keys with
  hyphens compile fine (tutor ships `'zh-TW'`).
- Local DB had 1022 `zh` i18n_translations rows (full set).

## Code changes (LOCAL — this session) — ✅ DONE
- ✅ `src/lib/i18n/locales.ts`: enum `zh='中文'` → `'zh-CN'='简体中文'` + `'zh-TW'='繁體中文'`
      (linter requoted all enum keys for consistency); rewrote `getSupportedLocale` (exact-match +
      `LOCALE_ALIASES` table, bare `zh`→`zh-CN`); added vitest (6 getSupportedLocale +
      findSupportedLocale tests, passing).
- ✅ `src/lib/translate/constants.ts`: AI_CONFIDENCE confident `'zh'` → `'zh-CN','zh-TW'`.
- ✅ `scripts/fetch-baked-i18n.mjs`: path regex `\w+` → `[\w-]+`.
- ✅ `src/lib/components/modals/SelectLanguage.stories.ts`: `covered` `'zh'` → `'zh-CN'`.
- ✅ Committed files: `git mv` `zh.json`→`zh-CN.json` (+ gl/ps/psAbbrev/sd); generated
      `zh-TW.json` (+4) via OpenCC `s2twp` (Taiwan phrases: 軟體/影片/資訊/預設/檔案/使用者/選單/登入…),
      `{token}` placeholders preserved. 1193 keys converted.
- ✅ Migration `20260722_rename_zh_locale_to_zh_cn.sql` (renames i18n_translations +
      translator_languages; auto-applied on the running dev server — local zh rows → zh-CN).
- ✅ New reusable `scripts/fill-locale-from-files.mjs <locale> [db]` — inserts AI-flagged rows
      from committed locale files for active keys only (ON CONFLICT DO NOTHING). Prod-portable
      (no OpenCC needed there — reads the committed zh-TW files).
- ✅ Filled dev `.data/shared.db`: zh-TW = 1192 rows (local zh-CN=1022 is a partial-snapshot
      artifact; on prod the fill will match prod's fuller zh-CN count).
- ✅ Verified: targeted vitest (i18n/export/constants/prune/filter-items — 21 passing), `tsc`
      clean, eslint 0 errors, svelte-look switcher screenshots (简体中文 + 繁體中文, light/dark),
      live SSR `?lang=zh-CN`→菜单/登录/关于 vs `?lang=zh-TW`→選單/登入/關於/建立.

## PROD rollout — ✅ DONE (2026-07-22)
- ✅ Jacob committed+pushed the code; deploy ran the boot migration → prod zh renamed to zh-CN (1213 rows).
- ✅ Backup taken (`r2/backups-rolling/db/living/2026-07-22T10-00-16Z.tar.zst`) — note: backups live
  at `r2/backups-rolling/db/<host>/`, NOT the stale `r2/backup/sqlite/` path (fixed in the
  fill-translations command).
- ✅ Filled prod `/data/shared.db`: 1192 zh-TW rows, all `source='ai', needs_review='ai'` (1 stale
  key skipped). Ran via `ssh living "docker exec -i sveltekit_blue node" < fill.mjs` (stdin so
  better-sqlite3 resolves from the app dir) + `/tmp/zh-tw-values.json` docker cp'd in.
- ✅ Live verified: `?lang=zh-CN`→菜单/登录/关于, `?lang=zh-TW`→選單/登入/關於/建立. Temp artifacts cleaned.
- Note: `zh-CN`=1213 vs `zh-TW`=1192 — the 21 gap is zh-CN rows for removed/inactive keys (not
  exported/shown); every ACTIVE key with Simplified now has Traditional parity.
- /translate "Notify translators" button is safe to press to alert zh-TW reviewers.

## (historical) PROD rollout plan — executed above
Tooling: `ssh living` works from mustang; active container `sveltekit_blue`.
1. `~/code/vps-setup/bin/backup-vps-db living` if today's cron backup hasn't run.
2. Apply rename + zh-TW fill to prod `/data/shared.db` (rename is idempotent w/ the boot migration;
   fill via the same script + the committed zh-TW value artifact — no OpenCC needed on prod).
3. Commit the code + renamed/new committed files + migration; push to `main` (deploy + bake).
   - Bake fetches from the OLD container (old enum) → emits only old-locale files → does NOT touch
     my committed `zh-CN.*`/`zh-TW.*` seeds → they ship correctly. New container's boot migration
     renames prod DB; zh-TW rows already inserted.
4. Post-deploy: verify switcher shows 简体中文 + 繁體中文, /translate lists zh-TW, spot-check pages.
   Remind Jacob the /translate "Notify translators" button is safe.

## Notes / out of scope
- Gloss/vernacular `zh` refs are SEPARATE from UI locale: `openapi.ts`, `gloss.interface.ts`
  comment, `SetLanguage.svelte` (mapbox), `og/component-to-png.ts` font map, glossing list `cmn`.
  Left untouched. (Could later add a zh-TW→Noto Sans TC OG font + relabel `cmn`.)

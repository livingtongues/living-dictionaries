# i18n translator backend — DB-backed translations, /translate UI, build-time baking

Replaces the Google Sheet translator workflow.
STATUS: ✅ COMPLETE (2026-07-03) — all code + tests + visual + e2e verification done; awaiting
Jacob's review/commit. See "Remaining for Jacob" at the bottom.

## Jacob's decisions (interview 2026-07-03)

- **English stays in code** (`en.json` + `gl/ps/psAbbrev/sd` section files) — types + agent-edited.
  Non-English source of truth moves to `shared.db`.
- **Serving = build-time baking, NOT runtime** (his call: no per-visitor server load, SSR just
  works). Mechanism = **fetch-from-the-running-site**: the image build can't see `/data`, but the
  OLD container still serves during `docker compose build`, so a Dockerfile `RUN` fetches
  `GET /api/i18n/export` and overwrites `src/lib/i18n/locales/**` in the build layer. Any failure
  (first deploy, site down) → committed files + loud warning, never a failed build. No
  vps-setup/deploy.sh changes; no "prepare build" admin button needed (every build self-serves).
- Committed locale files stay in place as **seed + fallback**: server boot imports them into the
  DB only when `i18n_translations` is empty (= the prod cutover import + fresh-dev seed).
- **Route `/translate`**, standalone with site Header (chat pattern), gate = ≥1
  `translator_languages` row or admin ≥2 (admins get every locale).
- **All five sections** + `relationship_type` groups automatically by key prefix (it exists only
  in EN → first `/fill-translations` workload). **Unpublished locales included**.
- **needs_review lifecycle**: boot-sync flags translations `en_changed` when EN changes; AI slash
  command triages (trivial → fix+clear, substantive → draft+leave flagged 'ai'); new AI fills =
  `source='ai', needs_review='ai'`. NO in-app AI button. Notify counts = missing + flagged.
- **Notify** = manual admin button on /translate → per-translator email (SES, `notify_user`
  path — renamed from `notify_chat_member`, admins keep ntfy pref) w/ per-locale counts + deep
  links `/translate?locale=xx&filter=pending`. Unsubscribe flag ignored (transactional).
- Retired `scripts/locales/` + the sheet; `glossing-languages-list.json` is hand-edited now.
- Multiple translators per language = last-write-wins w/ visible attribution; `{token}`
  placeholders highlighted + missing-token warning (warn-only); translator UI EN-only.
- Follow-on: `.issues/future/i18n-key-reorganization.md` (audit/reorganize all keys, own commit).

## What shipped (map)

- **Schema** — APPENDED to `20260703_user_roles_chat_channels_message_cc.sql` (NOT renamed; see
  gotcha below): `i18n_keys` (dotted-key EN catalog, `removed_at` soft delete), `i18n_translations`
  (UNIQUE (key_id, locale), `source` import|human|ai, `needs_review` NULL|ai|en_changed,
  updated_by snapshot), `translator_languages` (UNIQUE (user_id, locale)). Server-only like the
  chat tables — raw SQL + hand types, no Drizzle entry, excluded from sync (documented in
  `db/sync/types.ts`).
- `lib/server/i18n/`: `i18n-db.ts` (flatten_en/sync_en_catalog/seed_translations_if_empty/
  list_locale_rows/upsert/approve/stats/assignments + inline tests), `export.ts`
  (`export_locale_files` — file-layout-shaped payload; missing → `''` per loader convention),
  `api.ts` (`gate_translate` / `gate_translate_locale`), `boot.ts` (called from hooks.server.ts;
  never boot-fatal), `notification-email.ts` (pure builder + test).
- **Endpoints** (flat style + `_call.ts` + gate `server.test.ts`, 6 files / 20 tests):
  `GET /api/i18n/export` (public), `GET /api/translate/data?locale=`, `POST save` (empty value =
  delete), `POST approve`, `GET summary` (admin), `POST notify` (admin),
  `GET+POST /api/admin/users/[id]/translator-languages` (admin; GET because the table never syncs
  to admin mirrors).
- **Bake**: `site/scripts/fetch-baked-i18n.mjs` (zero-dep; validates full payload before writing;
  ALWAYS exits 0) + Dockerfile RUN before `pnpm build` + `pnpm i18n:refresh`.
- **/translate page**: locale select, filter chips (all/pending/missing/flagged + counts), search,
  sticky section heads, per-row editor (autosize textarea `dir="auto"`, EN with highlighted
  `{tokens}`, status chips, missing-token warn, save-on-blur + ⌘/Ctrl-Enter, "Looks good" approve,
  attribution), admin progress panel (per-locale cards → click to open, Notify button), URL-synced
  `?locale=&filter=`. `lib/translate/`: constants/placeholders (+tests), translate-store.svelte.ts
  (chat-store pattern), translate-row.svelte, admin-panel.svelte. Stories: 4 (`_page.stories.ts`).
- **Auth surface**: `AuthUserData.translator_locales` (admins → all) via get-user.ts;
  `AuthUser.translator_locales`/`is_translator` getters (hidden under View-as-Visitor); UserMenu
  "Translate" link; admin dashboard "Translations" box; TranslatorLanguagesCard on
  /admin/users/[user_id].
- **Slash command** `.claude/commands/fill-translations.md` — prod writes via the
  backup-vps-db `docker exec node` pattern; fill rules (placeholders, psAbbrev = abbreviations,
  match human register), en_changed triage policy, ends with `pnpm i18n:refresh` + commit + push
  (that push deploys + bakes).
- **Retired**: `scripts/locales/` (git rm) + its package script; AGENTS.md i18n bullet + routes
  updated.
- **Locale files refreshed** from the dev DB round-trip (seed → export → write): newer-than-sheet
  keys now present as `''` in every locale (sync/, map/, misc.reload/theme_*, relationship_type.*,
  …) and dead sheet keys dropped (`ps.va`, old `misc.optional` dupes, …). This diff is CORRECT —
  it makes the committed seed match the DB exactly.

## Verification done

- `pnpm test` 1171 passed (35 new) / tsc / lint / `pnpm check` / `pnpm build` all clean.
- svelte-look: /translate ×4 stories (light+dark, desktop+mobile), admin users page, admin dashboard.
- Browser e2e `site/tools/e2e/translate-flow.mjs` — 13 checks ALL PASS: fresh user gated → admin
  assigns es → card renders on admin user page (via live sync) → translator editor + UserMenu
  link → type+blur saves (source=human w/ attribution) → pre-seeded AI row flagged under
  "To review" → "Looks good" clears → empty-save deletes → no page errors.
- Live boot on dev: 981 keys mirrored, 14,294 translations seeded from committed files.
- Export→fetch round-trip verified against dev server; fetch fallback verified against prod
  (404 → warning, exit 0 — exactly the first-deploy bootstrap path).

## Gotchas / lessons

- **Migration append, not rename**: the 20260703 file was already recorded in dev DBs, so my DDL
  was APPENDED (pure `CREATE TABLE IF NOT EXISTS`) and applied surgically to mustang's
  `.data/shared.db` by running just the section. Admin browser mirrors that recorded the old file
  simply lack the tables — harmless (server-only, nothing reads them client-side). Prod applies
  the whole file fresh.
- **tuf's dev `.data/shared.db` still needs the same patch** (tuf was offline/unreachable from
  mustang). One-liner from `~/code/living-dictionaries/site`:
  `node -e "const D=require('better-sqlite3'),fs=require('fs');const db=new D('.data/shared.db');const s=fs.readFileSync('src/lib/db/schemas/shared-migrations/20260703_user_roles_chat_channels_message_cc.sql','utf8');db.exec(s.slice(s.indexOf('-- 5. i18n translator backend')));db.close();console.log('patched')"`
  (Skipping it → server boot crashes on the missing tables... actually no: boot_i18n_catalog
  catches + logs. But /translate + get_user's translator query would 500 — so run it.)
- e2e initially typed into `misc.downloading` which HAD a seeded value (appended text + cleanup
  deleted the real translation — restored by hand). Pick post-sheet keys (`misc.appearance`) for
  write tests.
- `notify_chat_member` → renamed `notify_user` (it was never chat-specific; translators are the
  second consumer). Chat call sites updated.

## Remaining for Jacob

1. Review + commit (includes the refreshed locale seed files) + push → deploy.
2. After deploy: run `/fill-translations` (relationship_type + the other `''` gaps are the first
   workload), then assign translators on /admin/users/[id], then hit "Notify translators".
3. Patch tuf's dev DB with the one-liner above (or ask an agent on tuf to).
4. Later: `.issues/future/i18n-key-reorganization.md`.

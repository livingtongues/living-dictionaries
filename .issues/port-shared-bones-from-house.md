# Port shared bones from house → living-dictionaries `site/`

> **Source**: this issue was produced by a 2026-05-20 audit across `house`, `living-dictionaries`, and `tutor`. House is now the canonical "site" reference for shared site infrastructure (auth, db/sync, **Phase-2 email backend**, sqlite-proxy, admin local-first patterns). LD's `site/` is a near-empty SvelteKit shell — verified 2026-05-22 to contain only `app.d.ts`, `app.html`, `lib/{assets, dark-mode.ts, index.ts, mocks, theme.css, Welcome.*}`, `routes/{+layout.svelte, +page.svelte}`, `static/`, and configs. Everything below is still to do.
>
> **Naming note (2026-05-20)**: living-dictionaries' `new-site` was renamed to `site`; legacy `packages/site` is now `packages/old-site`. All paths below use the new names.
>
> **Cross-app status**: all three apps (tutor, house, LD/site) now share `@unocss/svelte-scoped`. House and tutor share the email-out template pattern; **house and tutor are the canonical references for Phase-2 inbound email + threading** (LD ports it here).

---

## Summary table — where LD lags house

| Capability | house/site | ld/site | LD action |
|---|---|---|---|
| Svelte 5 + SvelteKit + adapter-node | ✅ | ✅ | — |
| Workspace pnpm + Dockerfile + compose | ✅ | ✅ root Dockerfile updated with better-sqlite3 dance | L1 ✅ |
| ESLint shared config | ✅ root | ✅ globs `site/`, locale-JSON whitespace override added | L12 ✅ |
| Vitest globals + `import.meta.vitest` | ✅ | ✅ separate `vitest.config.ts` + `$env`/`$app` mocks + tsconfig types | L13 ✅ |
| **UnoCSS svelte-scoped** | ✅ | ✅ | — |
| `@unocss/reset` + theme.css + dark-mode | ✅ | ✅ | — |
| `@iconify/json` | ✅ | ✅ | — |
| **svelte-look** + `svelte-look-mocks.ts` + `mocks/` | ✅ | ✅ | — |
| `app.html` + `static/` (favicon/robots/manifest) | ✅ full | ✅ ported from old-site (icons + fonts + images + manifest) | L18 ✅ |
| **better-sqlite3 + wa-sqlite + Drizzle (types only)** | ✅ | ⚠ deps installed (L1 ✅), schema/usage NOT yet wired | L2 |
| `lib/db/{client, server, sync, schemas}` | ✅ | ❌ | L2 |
| Sync engine + LiveDb + `process_sync` | ✅ | ❌ | L2 |
| `sqlite-proxy/` (HTTP+WS for agent SQL) | ✅ | ❌ | L10 |
| **Auth: email-OTP (jose-JWT, httpOnly cookie)** | ✅ | ❌ | L3 |
| `verify_auth` JWT helper + tests | ✅ | ❌ | L3 |
| `find-or-create-auth-user` + user/sub helpers | ✅ | ❌ | L3 |
| Google One Tap sign-in | ✅ | ❌ | L3 (port from house after email-OTP lands) |
| **AWS SES email sender** | ✅ | ❌ | L4 |
| Email Svelte templates + `render-component-to-html` | ✅ | ❌ | L4 |
| **Phase-2 email backend (inbound + threading)** | ✅ | ❌ | L4 |
| `lib/i18n` (locales + translator) | ⏸ deferred (English-only) | ✅ ported from old-site (en + 17 published + 4 unpublished × {base, gl, ps, psAbbrev, sd}) | L17 ✅ |
| `lib/svelte-pieces` tier-1 (Modal, Toast, HeadlessButton, ShowHide, bay, actions) | ✅ | ❌ | L9 |
| `lib/utils` library | ✅ port-on-use | ❌ | L5 |
| `notifications.ts` / toast system | ✅ | ❌ | L9 (lands with svelte-pieces) |
| `hooks.server.ts` (migration boot pass) | ✅ | ❌ | L11 |
| `.claude/skills/` | ✅ 5 new-stack | ⚠ 5 legacy-targeted | L14 |
| `.claude/commands/` | ✅ 4 | ❌ 0 | L15 |
| `.knowledge/` populated | ✅ growing | ⚠ skeleton (legacy-targeted) | L16 |

---

## Reference: Phase-2 email backend architecture (house's design, LD ports it)

End-to-end shape of the inbound/outbound/threading pipeline as it lives in house today.

**Outbound (Phase 1 + Phase 2 wraps it):**
1. `lib/email/send-email.ts` — AWS SES wrapper. Accepts `body: string | { html, text? }` for multipart deliverability.
2. `routes/api/email/components/` — Svelte components (`BaseLayout`, `OtpEmail`, `MessageReply`). `BaseLayout` is `<table>`-based email-safe with optional `show_chrome` (true for system mail, false for admin replies). `MessageReply` takes raw `body_html` via `{@html}` — admin is the trust boundary.
3. `routes/api/email/render-component-to-html.ts` — renders a Svelte component to HTML string server-side.
4. ESLint exception block in `eslint.config.js` disables `svelte/no-raw-special-elements` so `<html>` / `<table>` / `<style>` work in the email components folder.

**Inbound (Phase 2):**
1. Cloudflare Email Routing catches mail for the domain.
2. CF Worker (in a separate repo / `vps-setup`) does basic validation, gates with `INTERNAL_INGEST_SECRET`, POSTs the parsed message to the SvelteKit VPS.
3. VPS endpoint runs through `lib/email/loop-protection.ts` (auto-reply / out-of-office / bounce detection — drop early), then `lib/email/find-or-create-thread.ts` (match against existing `message_threads` by `from_email` + subject normalization, or create new), then inserts the `messages` row.
4. Attachments: `lib/email/save-attachment.ts` uploads to R2, stores key + content-type + size on `messages` row.
5. `lib/email/addresses.ts` — parse + normalize RFC 5322 addresses, separates display name from address.

**Threading + identity:**
- `message_threads.from_user_id` is **nullable** (inbound from strangers may have no matching `users` row).
- Every table that references users snapshots `from_email` + `from_name` (or `replied_by_email` / `replied_by_name`) at write time. The FK link is for live JOINs; the snapshot survives a user later changing their email.
- `message_threads` + `messages` live in `shared.db` (NOT a per-user db) so admin queries can `JOIN users` / `subscriptions` for filters like "active-sub messages this week".

**Admin reply path:**
- Admin composes reply in `/admin/messages/[thread_id]` composer.
- POST to `routes/api/messages/reply/+server.ts` — wraps body in `MessageReply.svelte` via `render-component-to-html`, sends via `send-email.ts` with proper `In-Reply-To` + `References` headers (from threading state), inserts an outbound `messages` row.

**LD adaptation:** replace house's `users` FK shape with LD's user table. Same sectoring (`messages` bidirectional, `directory` download-only) maps cleanly.

---

## Reference: SQLite query proxy — port mapping

House uses 4020-range so tutor's 4000-range stays free for parallel local dev across repos. **LD should pick its own range (e.g., 4040-range)** for the same reason.

| Script | Vite | WS | HTTP |
|---|---|---|---|
| `pnpm dev` | 4030 (LD pick) | 4040 | 4041 |
| `pnpm prod` | 4031 | 4042 | 4043 |

Formula: `ws = base + (vite_port - vite_base) * 2`, `http = ws + 1`.

The `sqlite_proxy()` Vite plugin is dev-only (`apply: 'serve'`). Browser-side live-share hook (`lib/db/client/live-share.svelte.ts`) is wired in `routes/admin/+layout.ts` so it only fires on `/admin/*` routes (where the wa-sqlite admin DB exists). CLI script: `scripts/sqlite-query.sh`. Deps: `ws@^8.19.0` + `@types/ws@^8.18.1`.

---

## Reference: UnoCSS svelte-scoped — gotchas worth keeping

All three apps now use `@unocss/svelte-scoped`. Notes for reference when patterns drift:

1. **vite.config**: `import UnoCSS from '@unocss/svelte-scoped/vite'` (NOT `'unocss/vite'`). No extractor needed.
2. **No `svelte.config.js` preprocess** — only apps using the vite plugin; the preprocess is for component libraries.
3. **No `transformerDirectives`** — `@apply` must be replaced by inline class composition or shortcuts.
4. **Global utilities** (resets, body styles) live in a normal CSS file (`theme.css`) imported in `+layout.svelte`.
5. **`presetIcons`** still works — `i-mdi-foo` tokens are scoped per-component.
6. **Wind4's built-in reset** (`presetWind4({ preflights: { reset: true } })`) replaces `@unocss/reset`.
7. **Known caveat**: `vite-plugin-svelte` 7+ emits a benign deprecation warning: `unocss:svelte-scoped:pass-preprocess uses removed plugin.api.sveltePreprocess api`. Will resolve when `@unocss/svelte-scoped` adopts the new `transformSvelte` API. Worth filing upstream eventually.
8. **svelte-kit sync** must run before svelte-look can screenshot (Vite 8's `vite:oxc` transformer needs a resolvable tsconfig chain).

---

# Outstanding work — LD site

## L0. Foundational decisions (do FIRST, before any code)

- [x] **Decide auth path**: ✅ Carbon-copy house's email-OTP-via-SES + jose-JWT (decided 2026-05-22 in auth interview). One-shot migration of legacy Supabase users on flip-over day. See `.issues/migrate-supabase-users-to-new-site.md`.
- [x] **Decide DB path**: ✅ SQLite-on-VPS (carbon-copy house). Per-dictionary `dictionaries/{id}.db` files + `shared.db`. Decisions fully captured in `.issues/port-db-sync-architecture.md`.
- [ ] **Rewrite `living-dictionaries/AGENTS.md`** — currently 100% targeted at legacy `packages/old-site` (PGlite + Supabase + Kitbook + Orama). Misleading for any agent landing in `site/`. Either restructure to clearly delineate `packages/old-site` legacy vs `site/` greenfield, or split into two AGENTS files.

## L1. Core dependencies

- [x] Add to `site/package.json`: `better-sqlite3`, `wa-sqlite`, `drizzle-orm`, `jose`, `@aws-sdk/client-ses`, `@types/better-sqlite3`.
- [x] Add `better-sqlite3` + `esbuild` to root `pnpm-workspace.yaml` `onlyBuiltDependencies`.
- [x] Update root `Dockerfile` with the better-sqlite3 native-build dance (LD already has a Dockerfile at repo root, not in `site/`; pattern matches house's: builder stage installs `python3 make g++` + runs install WITH scripts; runner stage copies the prebuilt `.node` binary).

## L2. DB layer (port from house verbatim)

**See `.issues/port-db-sync-architecture.md` for the full design.** Decisions Q1–Q9 are locked; Q10 (migrations strategy) still has 5 sub-questions to confirm before coding.

- [ ] `lib/db/client/{connection.ts, db.ts, live/}` — wa-sqlite + LiveDb (admin.db, main thread).
- [ ] `lib/db/server/{shared-db.ts, sync-helpers.ts, run-sql-migrations.ts, typed-query.ts}`.
- [ ] `lib/db/sync/{engine.svelte.ts, errors.ts, history.svelte.ts, types.ts, SyncStatus.svelte}`.
- [ ] `lib/db/schemas/{shared.ts, shared.types.ts, json-columns.ts, shared-migrations/}`.
- [ ] First migration: `YYYYMMDD_initial.sql` — users + dictionaries catalog as the MVP seed tables.
- [ ] Per-dictionary.db infrastructure (Phase 2 in the design doc — Web Worker + OPFS VFS).
- [ ] R2 snapshot pipeline (Phase 3 in the design doc — 30-min cron, versioned blobs + latest.json).

## L3. Auth (port from house, email-OTP path) ✅ DONE 2026-05-26

- [x] `lib/auth/{jwt.ts, types.ts, user.svelte.ts, verify.ts, verify.test.ts, google.ts, google-one-tap.ts, load-script-once.ts}` — ported (LD-adapted: AuthUserData drops subscription/free-trial/has-stripe-customer, adds `preferred_locale`; admin_level is `1 | 2 | null`).
- [x] `lib/server/{find-or-create-auth-user.ts, get-user.ts, send-welcome-email.ts}` — LD has no subscription helper (no billing).
- [x] `routes/api/auth/{email/send-code, email/verify, me, logout, google}` — full set ported.
- [x] `routes/login/+page.svelte` — adapted copy + implicit ToS footer.
- [x] `routes/+layout.server.ts` + `routes/+layout.ts` for SSR + reactive auth hydration.
- [x] `lib/admins.ts` already had the allow-list pattern; `verify-dict-role.ts` now derives `admin_level` per-request via `get_admin_level(email)`.
- [x] Google One Tap ported alongside email-OTP. PUBLIC_GOOGLE_OAUTH_CLIENT_ID read via `$env/dynamic/public`.
- [x] **Dev-identity stub + `x-dev-user-id`/`x-dev-email` headers removed** from SharedWorker + `/test/dict-sync/[id]` + seed endpoint. Cookie-only flow.
- [x] See `.knowledge/decisions/auth-l3-port.md` for permanent decisions doc.

## L4. Email backend — port from house ✅ DONE 2026-05-26

- [x] `lib/email/{addresses.ts, send-email.ts, send-raw-email.ts, loop-protection.ts, find-or-create-thread.ts}` ported. (`save-attachment.ts` exists in spirit as `lib/r2/put-attachment.ts` — separate file because LD uses a distinct `R2_ATTACHMENTS_BUCKET` from snapshots.)
- [x] Email Svelte templates + `render-component-to-html.ts` ported (`BaseLayout`, `OtpEmail`, `MessageReply`, plus LD-specific `NewUserWelcome`).
- [x] Phase-2 inbound endpoint `routes/api/messages/email-inbound/+server.ts` — full implementation; the CF Worker that POSTs to it is OUT-OF-SCOPE (lives in `vps-setup/` or a new `cf-worker/livingdictionaries/`).
- [x] Contact-form endpoint `routes/api/messages/contact/+server.ts`.
- [x] Admin reply endpoint `routes/api/messages/reply/+server.ts` — auth-gated to `is_admin`, generates RFC `Message-ID`, threads via `In-Reply-To`/`References`, persists pending → sent/failed in `messages`.
- [x] `message_threads` + `messages` + `message_attachments` migration (`20260526_messages.sql`) — replaces `process_delete_cascade` trigger to handle the new tables.
- [x] All three message tables wired into `SYNCABLE_TABLE_NAMES`.
- [x] ESLint exception block for the email components folder added.

### Deferred follow-ups (separate work products)
- CF Worker for `livingdictionaries.app` zone (`vps-setup/` or `cf-worker/livingdictionaries/`).
- Admin attachment-download endpoint (signed R2 URL fetch from admin UI).
- ntfy push notifications on inbound (needs `ntfy_topic` column on `lib/admins.ts`).
- Agent triage hook (parity with house's `fire_agent_email_inbound`).

## L5. Constants + utils

- [ ] `lib/constants.ts` (LD-specific constants).
- [ ] `lib/utils/requests.ts` + the same generic-helper subset used in house (port-on-use, not bulk).

## L6. Routes scaffold

- [ ] `routes/+page.server.ts` (replace placeholder home page with something that reads from `shared.db`).
- [ ] `routes/api/admin-sync/+server.ts` (port from house).
- [ ] `routes/admin/+layout.server.ts` + `routes/admin/+layout.svelte` (admin gate + shell).

## L9. svelte-pieces — copy from house

- [ ] Port tier-1 set: `Modal`, `Toasts`, `HeadlessButton`, `ShowHide`, `bay/`, action utilities (`clickoutside`, `focus-on-mount`, `portal`, `trapFocus`). Copy from `~/code/house/site/src/lib/svelte-pieces/` rather than tutor (they should diverge minimally; house already incorporates tutor's refinements).
- Tier-2 (forms, toggles, progress, etc.) lives at `~/code/house/.knowledge/ui/svelte-pieces-deferred.md` — port on demand when LD first needs each piece.

## L10. SQLite query proxy

- [ ] Port `sqlite-proxy/` (identical between house and tutor; pick whichever's easier). Use the 4040-range port mapping above so LD can run in parallel with house and tutor on the same machine.

## L11. hooks.server.ts + job worker skeleton

- [ ] Skeleton mirroring house's `hooks.server.ts` — force-call `get_shared_db()` at module load so migrations apply at boot, not on first DB-touching request. (Discovered live in house 2026-05-19 when a pending migration sat unapplied for 21h because no request had hit the lazy lookup yet.)
- Worker pattern (`start_worker_once` + `JOB_HANDLERS` + `agent_jobs` migration) is deferred in both house and LD — add when the first concrete async background job actually arrives.

## L12. ESLint

- [x] Confirmed root `living-dictionaries/eslint.config.js` already ignores `packages/**` and lints `site/`. Updated header comments to reference `site/` instead of stale `new-site/` naming.
- [x] Added override §19 to disable `no-irregular-whitespace` for `site/src/lib/i18n/locales/**/*.json` — translated strings legitimately contain NBSPs (French punctuation), bidi marks (Hebrew/Arabic), etc.
- [x] Mirror house's hand-written rules so output matches. (Already aligned; verified via `pnpm lint` clean.)
- [ ] Add the email-template ESLint exception block when L4 templates land.

## L13. Vitest config in `site/vite.config.ts` ✅

- [x] Added `define: { 'import.meta.vitest': 'undefined' }` to `site/vite.config.ts` so in-source test blocks get stripped at build time.
- [x] Created separate `site/vitest.config.ts` mirroring house's pattern (loads only `vite-plugin-svelte`, NOT `sveltekit()`, so `process.env` stays clean from `.env`).
- [x] Added `$env/*` and `$app/environment` mock files in `site/src/lib/mocks/`: `env-dynamic-private.ts`, `env-dynamic-public.ts`, `env-static-public.ts`, `app-environment.ts` (Proxy-based passthrough to `process.env` for the dynamic ones).
- [x] Added `"vitest/globals"` + `"vitest/importMeta"` to `site/tsconfig.json` `types[]` so `describe`/`test`/`expect`/`import.meta.vitest` resolve under tsgo.
- [x] Verified: `pnpm --filter=site test` passes 6 inline tests across 2 files (interpolate.ts + i18n/index.ts).

## L14. `.claude/skills/`

LD currently has: `api-endpoint`, `database`, `learn-about-app`, `svelte`, `svelte-ui` — but most are written against the legacy stack (Supabase/PGlite). House has: `api-endpoint`, `database`, `sqlite-query`, `svelte`, `svelte-ui` — written against the new stack.

- [ ] Decide per skill: rewrite to point at new `site/`, or scope existing to `packages/old-site` and add new versions for `site/`.
- [ ] Port `sqlite-query` from house once L10 lands.

## L15. `.claude/commands/`

- [ ] Port four from house: `debug-vps`, `backup-vps-db`, `prod-db`, `scan-and-fix-errors`.

## L16. `.knowledge/`

- ⚠ Has `architecture/`, `decisions/` skeleton, but populated for legacy. Decide:
  - [ ] Reorganize as `legacy/architecture/*` and `site/architecture/*`, or
  - [ ] Leave legacy in place; agents working in `site/` write fresh pages keyed by topic.

## L17. i18n — needed from day one ✅

- [x] Ported `lib/i18n/` from old-site directly (which already had the canonical `getTranslator(locale)` + English-fallback pattern). LD's full locale set + locale JSON files (en + 17 published + 4 unpublished × {base, gl, ps, psAbbrev, sd} = ~85 JSON files) all copied.
- [x] Renamed `changeLocale.ts` → `change-locale.ts` (kebab-case file convention).
- [x] Converted function names to snake_case: `getTranslator` → `get_translator`, `setLocaleCookie` → `set_locale_cookie`, `changeLocale` → `change_locale`, `findSupportedLocaleFromAcceptedLanguages` → `find_supported_locale_from_accepted_languages`, `getSupportedLocale` → `get_supported_locale`, `unpublishedLocales` → `unpublished_locales`, `dynamicKey` → `dynamic_key`.
- [x] Updated JSON imports from deprecated `assert { type: 'json' }` to modern `with { type: 'json' }` syntax.
- [x] Verified: `pnpm --filter=site check` clean, `pnpm --filter=site test` passes inline i18n tests.

## L18. `app.html` + `static/` ✅

- [x] Copied `static/{icons/, fonts/, images/, manifest.json}` from `packages/old-site/static/` into `site/static/`. (Kept `site/static/robots.txt` as-is — the old-site version blocked the `/onondaga/` path which is legacy.)
- [x] Upgraded `app.html`: added theme-color, color-scheme, application-name, mobile-web-app-capable, apple-mobile-web-app-capable, mask-icon, apple-touch-icon, manifest link, full set of iOS splashscreen `<link>`s, and `favicon-32x32_adjusted.png` as the icon. Preserved Svelte 5 / svelte-scoped structure (no inline gtag — defer adding analytics until needed).
- [x] Removed the `$lib/assets/favicon.svg` injection from `+layout.svelte` since `app.html` now provides the icon link. `$lib/assets/favicon.svg` still exists for any future component use.

---

## Deferred / future (port-on-demand from house or tutor)

Not part of the initial port; listed here so they stay on radar. LD can pull from `~/code/house/site/src/lib/...` or `~/code/tutor/site/src/lib/...` as each demand arrives.

- **Apple sign-in** — `lib/auth/apple.ts` exists in tutor. Port alongside L3's Google One Tap if LD wants iOS-native sign-in.
- **Usage tracking helpers** — tutor has `track-api-usage.ts`, `api-pricing.ts`, `check-usage-cap.ts`, `is-over-cap.ts`. Port when LD ships an LLM-backed feature or billing flow that spends money per-user.
- **Async job worker** — when LD's first concrete background job arrives (durable webhook retries, agent-handled inbound triage, etc.): port tutor's `lib/agent/jobs/{worker.ts, handlers.ts, queue.ts}` + an `agent_jobs` migration, and extend L11's `hooks.server.ts` with a `start_worker_once` boot pattern. Empty `JOB_HANDLERS` to start.
- **svelte-pieces tier-2+** — see `~/code/house/.knowledge/ui/svelte-pieces-deferred.md` for the full catalog (forms, toggles, progress, intersection observer, etc.) with pointers back to the tutor originals.

---

## Cross-repo strategy

- **Lift truly shared pieces into a workspace package** when duplication starts to bite. Top candidates: `lib/db/`, `lib/auth/`, `lib/svelte-pieces/`, `sqlite-proxy/`, `lib/email/`. Tutor's monorepo structure (`capacitor-tts/`, `capacitor-update/` as workspace packages) is the proof-of-concept. Counterpoint: copy-paste-then-diverge is fine for now and avoids premature abstraction.
- **House is the canonical "site" reference** for site infra (auth, db, sync, Phase-2 email backend). LD/site copies from house for those patterns; tutor still needs to port the inbound/threading half of Phase-2 email (tracked in tutor's repo separately).
- **Tutor is still the canonical reference** for domain-layer patterns it hasn't been replaced on (job worker, third-party auth providers, i18n).
- **Update LD's `AGENTS.md` as each section lands** so the docs track the code (L0 task).

---

## Lessons learned / discoveries to carry forward

- LD's root `AGENTS.md` is heavily targeted at the legacy `packages/old-site` and conflicts with the greenfield `site/` reality. Worth fixing before agents do meaningful site work (L0).
- Tutor's Dockerfile uses a committed prebuilt `.node` binary (`prebuilds/better_sqlite3-linux-musl-x64.node`) — house went a different route (build in builder stage, copy `.node` to runner stage via `find` + path matching). Both work; house's approach is cleaner because no binary is checked into the repo. **Use house's pattern for LD.**
- Tutor uses `varlock` for typed env. House tried it and removed it (leak-detector false-positives on path-like values + prepare-script chicken-and-egg ergonomics outweighed the value). **LD should NOT adopt varlock.** Stick with traditional `.env` + the Proxy-based `$env/dynamic/private` vitest alias (the genuinely useful piece we kept from the varlock experiment).
- House's `hooks.server.ts` was added 2026-05-19 after production was found running 21h with the Phase-2 migration unapplied (no DB-touching request had hit the lazy `get_shared_db()` yet). The hook now force-applies migrations at module-load time. **Carry this pattern verbatim into LD (L11).**
- Legacy LD's `page.data.db` PGlite reactive interface (in legacy AGENTS.md) is conceptually identical to house's `LiveDb` pattern. House's might benefit from adopting the same row-method conventions (`_save()`, `_delete()`, `_reset()`). Worth comparing API shapes when L2 ports the LiveDb.

# M4 · Real auth — replace the M1 auth stub with JWT + Google + email-OTP + SQLite users/roles

Sub-session **LD-AUTH** on `vps-migration`. Replaces the M1 hand-wave mock (a logged-in
"achi manager") with real authentication: email-OTP + Google One-Tap → signed JWT in an
httpOnly `session` cookie → SQLite `users`/`email_codes`/`dictionary_roles`. `can_edit` /
`is_manager` resolve from **real `dictionary_roles`** (client display gating) and
`verify_auth_dict_role` (server write gating).

## Reference sources
- PRIMARY: `living-dictionaries-example/site/src/lib/auth/*`, `routes/api/auth/*`, `lib/admins.ts`,
  `lib/server/{find-or-create-auth-user,get-user,send-welcome-email}.ts`. LD-tailored already.
- SECONDARY: `~/code/house/site` — proven fresh build + the **send-code rate-limit fix** (count
  send attempts in an in-memory map BEFORE the invalidating DELETE; the example's count-rows
  approach is the latent bug where the DELETE wipes the count so 429 is unreachable).

## What already exists in LD (built on)
- `lib/db/schemas/shared.ts` is **identical** to the example → `users`, `email_codes`,
  `email_aliases`, `dictionary_roles` tables + the `shared-migrations/20260525_initial.sql`
  (identical) are already in LD. shared.db is live (M4-read).
- `lib/db/server/{shared-db,get-dictionary,get-dictionaries-catalog}.ts` exist.
- Email send infra present: `routes/api/email/{send-email.ts,render-component-to-html.ts,addresses.ts,components/*}`.
  `send-email.ts` already uses SES (`AWS_SES_*`), string `body` + `type`. Prod LD uses SES.
- `@aws-sdk/client-ses`, `better-sqlite3` in `dependencies`; `@types/google-one-tap` in devDeps.
- `PUBLIC_GOOGLE_OAUTH_CLIENT_ID` value = `215143435444-...apps.googleusercontent.com`
  (same id LD already hardcodes in `supabase/auth.ts`; in example `.env`). `JWT_SECRET` in
  example `.env.local`. Jacob owns `.env`; dev OTP path returns the code so SES is NOT needed for e2e.

## The stub being replaced (chokepoints)
1. `lib/supabase/index.ts` → `getSession()` returns `mock_auth_response` (mock achi-manager).
2. `lib/mocks/mock-user.ts` → `MOCK_USER_ID` / `MOCK_MANAGED_DICTIONARY_ID='achi'`; also feeds
   `dummy-entries.ts` (entry author ids) + `stub-client.ts`'s `dictionary_roles` dummy row.
3. `hooks.server.ts` → `locals.getSession()` wraps the mock; 7 API endpoints consume it
   (`db/{create,delete}-dictionary`, `db/update-dev-admin-role`, `email/{invite,new_user}`,
   `gcs_serving_url`, `upload`).
4. Root `+layout.ts` builds: `user` store (`createUserStore` over supabase auth),
   `my_dictionaries` (queries `dictionary_roles` via stub supabase), `admin` =
   `user.app_metadata.admin`. `[dictionaryId]/+layout.ts` derives `is_manager`/`is_contributor`/
   `can_edit` from `admin` + `my_dictionaries`. ~12 components read `$page.data.user` / those stores.

## Resolved decisions (interview 2026-06-04)
- **Q1 = FULL PORT.** Replace LD's Supabase-shaped `user` store with the example's `AuthUser`
  + `ssr_user` + `dict_roles` model **everywhere**, rewriting all consuming components. The
  example already pioneered this exact model — it's the template.
- **Q2 = pure dev-OTP** (send-code returns `code` in dev) + seed a real `users` row +
  `dictionary_roles` manager row for `achi` (non-admin manager) so `can_edit` resolves from real data.
- **Q3 = show edit affordances** (real `can_edit`) but mutations stay stubbed/no-op until M4-write.
- **Q4 = rework achi-flow** to dev-OTP login as the seeded achi-manager; assert `can_edit`/edit-UI;
  defer mutation-persistence asserts to M4-write.
- **Dev "Set Admin Role Level":** re-establish via a **dev-only admin-level override cookie**
  (`dev_admin_level=0|1|2`), honored ONLY when `dev`, applied at the server admin-level resolution
  point (a `resolve_admin_level({ email, cookies })` helper used by `+layout.server.ts`,
  `auth/me`, `verify-dict-role`). A dev-gated button (User shell) sets/clears it + `invalidateAll`.
  Faithfully reproduces the old toggle in the allow-list world. **Report to orchestrator for house.**

## Strategy — FULL PORT (example's AuthUser/ssr_user/dict_roles model)
Port the example's auth subsystem verbatim where possible, then rewrite LD's consumers.

### Consumer surface to rewrite (LD, *.svelte unless noted)
- `$user` → `page.data.auth_user.user` (7 files)
- `$admin` (Readable<number>) → `page.data.auth_user.user?.admin_level` / `>= 1` checks (17 files)
- `$is_manager` / `$can_edit` / `$is_contributor` (Readable<bool>) → plain `page.data.{can_edit,is_manager}`
  booleans from `[dictionaryId]/+layout.ts` (13 files)
- `authResponse` (4) + `supabase.auth.*` (7) → removed/replaced by `/api/auth/*` + AuthUser
- `app.d.ts` PageData typing rewritten

### Port (new files)
- `lib/admins.ts` (allow-list: just `jwrunner7@gmail.com` level 2).
- `lib/auth/jwt.ts` (jose HS256, 30-day), `verify.ts` (cookie-first), `verify-dict-role.ts`
  (server write gating from real `dictionary_roles`), `google.ts` (verify Google id_token),
  `google-one-tap.ts` (rewired to LD modal/stores), `load-script-once.ts` (or reuse svelte-pieces `loadScriptOnce`).
- `lib/server/find-or-create-auth-user.ts`, `get-user.ts`. (welcome-email optional — can reuse
  LD's existing email endpoints; keep minimal.)
- `routes/api/auth/{email/send-code,email/verify,google,logout,me}/` (`+server.ts` + `_call.ts`).
  send-code uses **house's in-memory rate-limit counter** (the FIX). Dev returns `code`.
  OTP email send via LD's existing `send-email` (plaintext like the current `/api/email/otp`).

### Replace chokepoints (bridge wiring)
- **Server-only user resolution:** root `+layout.server.ts` reads `session` cookie → `verify_jwt`
  → user row from shared.db → returns `user` (legacy `BaseUser` shape: `id`, `email`,
  `app_metadata.admin = get_admin_level(email) ?? 0`, `user_metadata.{full_name,avatar_url}`)
  + `my_dictionaries` (real `dictionary_roles` joined to catalog). Invalid/absent cookie → null.
  Stop reading `sb-access-token`/`sb-refresh-token`.
- Root `+layout.ts`: `user = writable(data.user)`, `admin = derived(user, admin field)`,
  `my_dictionaries = readable(data.my_dictionaries)`. **Remove the `getSession` call.** Keep
  `getSupabase()` (non-auth stub reads still ride it until M4-write).
- `hooks.server.ts` `locals.getSession`: verify `session` cookie → legacy-shaped AuthResponse
  (+ stub `supabase`) so the 7 API endpoints keep working with real identity/admin.
- `getSession` in `supabase/index.ts` → real server-side cookie-JWT verify (no more mock).
- `[dictionaryId]/+layout.ts`: unchanged — now derives from real `admin` + `my_dictionaries`.
- New helper: resolve a user's `dictionary_roles` from shared.db joined to catalog →
  `DictionaryWithRoles[]` (for `my_dictionaries`).

### Login UI rewire
- `AuthModal.svelte`: send via `api_auth_email_send_code` (dev → autofill returned code), verify
  via `api_auth_email_verify` → `invalidateAll()` + close. Google button via new `google-one-tap`.
- `supabase/auth.ts` `sign_out` → `api_auth_logout` + `invalidateAll`.
- `User.svelte`: one-tap from new module.
- Retire `mock-user.ts` auth bits (keep id constants only if `dummy-entries.ts` still needs them,
  or repoint to the seeded test user id).

### Seed (for e2e of a real, NON-admin dictionary manager)
- Seed a `users` row + `dictionary_roles` manager row for `achi` (test user), so `can_edit`
  resolves from real data for a non-admin. Add to the achi seed script.

### Deps / env
- Add `jose` to `dependencies` (server-only; adapter-node externalizes). Lockfile fidelity.
- Env (Jacob owns): `JWT_SECRET`, `PUBLIC_GOOGLE_OAUTH_CLIENT_ID` (known value), `AWS_SES_*`
  (already). Google = graceful no-op if `PUBLIC_GOOGLE_OAUTH_CLIENT_ID` unset (house pattern).

## Scope boundary (AUTH only)
Logged-in **reads** work after this. **Writes/sync** = M4-write (not done). So a manager SEES
edit affordances (`can_edit` real) but mutations stay stubbed/no-op until M4-write. `achi-flow`
e2e reworks to: dev-OTP login as the seeded achi-manager → assert `can_edit` true / edit UI
present; defer mutation-persistence asserts to M4-write.

## Verify
- `pnpm --filter=site check` 0 errors · `test --run` green (port jwt/admins/find-or-create vitest blocks)
- `build` + `node build` boot
- headless (shared `browser-launch.mjs`) vs `node build`: drive dev-OTP from inside the page →
  logged-out → logged-in → admin → dict-manager; assert chokepoints resolve from REAL data
  (`can_edit` true only for a real manager of that dict), `page.on('pageerror')` empty.

## Implementation progress
- [x] Ported `lib/auth/*` (jwt, verify, verify-dict-role, google, google-one-tap, load-script-once,
      types, user.svelte, verify.test), `lib/admins.ts`, `lib/me/dictionary-roles.svelte.ts`,
      `lib/server/{find-or-create-auth-user,get-user}.ts`.
- [x] `/api/auth/{email/send-code,email/verify,google,logout,me}` + `/api/me/{dictionary-roles,dictionaries}`.
      send-code uses house's in-memory rate-limit FIX; INSERT keeps `created_at` (LD schema = NOT NULL).
- [x] Dev admin override: `lib/server/resolve-admin-level.ts` (`dev_admin_level` cookie, dev-gated) +
      `/api/auth/dev-admin-level` endpoint, wired into get-user / verify-dict-role / +layout.server.
      Deleted `/api/db/update-dev-admin-role`. **House should mirror this.**
- [x] Chokepoints: `+layout.server.ts` resolves `ssr_user` from session-cookie JWT; `+layout.ts` =
      AuthUser + dict_roles + plain `admin`/`my_dictionaries`; `[dictionaryId]/+layout.ts` = plain
      `can_edit`/`is_manager`/`is_contributor` from real `dictionary_roles` + admin; `hooks.server.ts`
      `locals.getSession` = real-JWT legacy shim (`get-legacy-session.server.ts`) for 6 legacy
      write/media/email endpoints (M4-write/media territory).
- [x] Login UI: AuthModal + User shell + account → new endpoints/AuthUser/sign-out + google-one-tap.
- [x] Swept ~37 consumers (`$user`→auth_user.user field renames; `$admin`→plain `admin`; role stores→plain).
- [x] Retired `supabase/{auth,sign_in,user}.ts`, `/api/email/otp`, mock auth response; jose added (lockfile hand-edited).
- [x] Seed: `seed:achi-fixture` now also seeds shared.db user `achi-manager@example.com` + manager role.
- [x] e2e reworked: dev-OTP login (E2E_EXPOSE_OTP escape hatch for prod `node build`), asserts
      logged-out read-only → login as NON-admin manager → can_edit true → edit flow → no pageerror.
- [x] Fixed a `can_edit` cold-cache bug found by the e2e: root `+layout.ts` now AWAITS
      `dict_roles.refresh()` on first authenticated load (cold cache) so managers don't flash
      read-only. (📘 knowledge doc.)
- [x] **Verify: check 0 errors / 15 warn · test 160 pass · build ✔ · achi-flow e2e PASS** (6 steps +
      non-admin manager role assertion + no pageerror). ⏳ Jacob eyeballs :3041 login/admin/manager.

## Resolved decisions recap
- Q1 = FULL PORT · Q2 = dev-OTP + seeded achi-manager · Q3 = show affordances (no-op writes) ·
  Q4 = achi-flow reworked · dev admin toggle = `dev_admin_level` cookie (report to house).

## Env (Jacob owns .env)
- `JWT_SECRET` (server, required for sign/verify) · `PUBLIC_GOOGLE_OAUTH_CLIENT_ID`
  (`215143435444-…`, graceful no-op if unset) · `AWS_SES_*` (already, prod email only).

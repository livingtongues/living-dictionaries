# Admin backend rollout for `site/` (L3 + L4)

Session-scope rollup of D1–D6 deliverables. Distill into `port-shared-bones-from-house.md` (mark L3 + L4 done) on completion.

## Interview decisions (locked)

- **Q1 Order:** D1 first, then D2 → D3 → D4 → D6. D5 (manual browser verification) skipped per parent confirmation.
- **Q2 `verify_auth` shape:** Match house exactly. Returns `{ user_id, email, name }` (no `admin_level` in JWT). `admin_level` is derived per-request from `get_admin_level(email)` against the `$lib/admins.ts` allow-list. Single source of truth.
- **Q3 SharedWorker auth:** Drop `x-dev-user-id` + `x-dev-email` headers entirely. Same-origin `fetch()` auto-sends cookies. Keep the `bearer` field on `AuthHeaders` for future non-browser callers (CLI scripts); unused in browser code.
- **Q4 Test harness post-D1:** Kill `lib/auth/dev-identity.ts` entirely. Test page redirects to `/login` if no `session` cookie. `/api/dev/seed-test-dict` gated to dev-only, uses real `verify_auth(event)`.
- **Q5 `AuthUserData` shape:** Drop subscription/free-trial/has-stripe-customer. Keep `unsubscribed_from_emails` (boolean derived from timestamp), add `preferred_locale: string | null`. Admin level typed as `1 | 2 | null`.
- **Q6 Welcome email + ToS:**
  - ToS: Path A — implicit "by signing in you agree…" copy in `/login` footer. No `terms_agreement` column.
  - Welcome email: YES — both house and LD send a welcome email on `created === true`. LD copy adapted from legacy `packages/old-site/src/routes/api/email/html/newUserWelcome.ts`. Fire-and-forget in OTP verify + Google callback endpoints. Welcome email template + send function lands in **D3**; D1 wires the callsite with a temporary stub.
- **Schema additions for D1:**
  - Added `preferred_locale TEXT` column to `users`.
  - Changed `unsubscribed_from_emails` from `INTEGER NOT NULL DEFAULT 0` to `TEXT` nullable timestamp.
  - Did not add `welcome_email_sent` or `terms_agreement`.

---

## D1 — L3 Auth port  ✅ COMPLETE

All work landed. Pipeline clean: `pnpm --filter=site check` 0 errors, `pnpm --filter=site test` 77/77 passing, `pnpm lint` clean.

### Files added / modified

**Created:**
- `site/src/lib/auth/jwt.ts` (with 8 in-source tests)
- `site/src/lib/auth/types.ts` (LD-specific AuthUserData)
- `site/src/lib/auth/user.svelte.ts`
- `site/src/lib/auth/verify.test.ts` (7 tests, all passing)
- `site/src/lib/server/find-or-create-auth-user.ts` (with 7 in-source tests)
- `site/src/lib/server/get-user.ts`
- `site/src/lib/server/send-welcome-email-stub.ts` (placeholder; real impl in D3)
- `site/src/routes/api/auth/email/send-code/{+server,_call}.ts`
- `site/src/routes/api/auth/email/verify/{+server,_call}.ts`
- `site/src/routes/api/auth/me/{+server,_call}.ts`
- `site/src/routes/api/auth/logout/{+server,_call}.ts`
- `site/src/routes/login/+page.svelte`
- `site/src/routes/+layout.server.ts` (SsrUser resolution from cookie)
- `site/src/routes/+layout.ts` (AuthUser hydration from ssr_user)

**Modified:**
- `site/src/lib/db/schemas/shared-migrations/20260525_initial.sql` — added `preferred_locale`, changed `unsubscribed_from_emails` to TEXT.
- `site/src/lib/db/schemas/shared.ts` — Drizzle column updates to match.
- `site/src/lib/auth/verify.ts` — REAL cookie+Authorization implementation (was stub).
- `site/src/lib/auth/verify-dict-role.ts` — derives `admin_level` from `get_admin_level(auth.email)` rather than reading off the JWT.
- `site/src/lib/db/dict-client/rpc-types.ts` — `AuthHeaders` shrunk to `{ bearer?: string }`.
- `site/src/lib/db/dict-client/fetch-snapshot.ts` — dropped dev-headers, added `credentials: 'include'`.
- `site/src/lib/db/dict-client/dict-sync-engine.ts` — same treatment.
- `site/src/routes/api/dev/seed-test-dict/+server.ts` — added `auth.email` null-guard.
- `site/src/routes/api/dev/seed-test-dict/_call.ts` — uses `post_request` (cookie-based).
- `site/src/routes/api/dictionaries/[id]/roles/+server.ts` — added `auth.email` null-guard before SQL insert.
- `site/src/routes/test/dict-sync/[id]/+page.svelte` — uses `page.data.auth_user`, redirects to `/login` if absent.
- `site/src/lib/db/server/sync-helpers.ts` — VALID_COLUMNS.users includes `preferred_locale`.
- `site/src/lib/db/server/sync-roundtrip.test.ts` — fixture rows updated for new schema (`unsubscribed_from_emails: null`, `preferred_locale: null`).

**Deleted:**
- `site/src/lib/auth/dev-identity.ts`

### Open env todos (not blocking; deployment-time)
- LD's `.env.local` (dev): document `JWT_SECRET=dev-secret-at-least-32-chars-long-for-hs256` (or similar). Code throws if missing.
- LD's prod `/opt/hosting/sveltekit/.env` (`ssh living`): set a real `JWT_SECRET` (random 64+ char). Jacob deploys when ready.

### Behavioral guarantees post-D1
- Real cookie/JWT-based auth. Sign in at `/login` with any email; dev returns the code inline and auto-submits verify; cookie persists for 30 days.
- `verify_auth` is the single auth checkpoint; site-admin allow-list is the only source of truth for admin-level.
- SharedWorker browser flows are cookie-only — no dev-header juggling.
- Test harness `/test/dict-sync/[id]` redirects to `/login` if signed-out.

---

## D2 — Google One Tap  ✅ COMPLETE

- [x] Ported `site/src/lib/auth/google.ts` (verbatim from house — server-side ID-token verifier).
- [x] Ported `site/src/lib/auth/google-one-tap.ts` — swapped `$env/static/public` import to `$env/dynamic/public` so svelte-check doesn't need a build-time literal (LD has no `.env.local` checked in). Replaced house's `toast` calls with `console.error` (svelte-pieces lands in L9).
- [x] Created `site/src/lib/auth/load-script-once.ts` — minimal helper to lazy-load the GSI script. Goes away when svelte-pieces lands in L9.
- [x] Added `@types/google-one-tap@^1.2.7` to devDependencies.
- [x] Ported `site/src/routes/api/auth/google/{+server.ts,_call.ts,server.test.ts}` — Google route also fires welcome-email stub on `created === true`.
- [x] Wired `display_one_tap_button(google_button_parent)` back into `site/src/routes/login/+page.svelte`.
- [x] Tests: 7 new Google route tests passing (request validation, cookie issuance, provider linking, re-login refresh).

### Open env todos (deployment-time)
- LD's `.env.local`: set `PUBLIC_GOOGLE_OAUTH_CLIENT_ID=215143435444-fugm4gpav71r3l89n6i0iath4m436qnv.apps.googleusercontent.com` (legacy reuse — decision in migrate-supabase-users-to-new-site.md).
- Before flip-over day: add new-site's production origin(s) to **Authorized JavaScript Origins** in Google Cloud Console for that client_id.

---

## D3 — L4 Email backend  ✅ COMPLETE (outbound)

Outbound + threading infrastructure ported. `send-raw-email.ts` + `save-attachment.ts` deferred to D4 (only the reply / attachment-upload path needs them).

### Files added
- `site/src/lib/email/addresses.ts` — LD-specific `no_reply_address`, `support_address`.
- `site/src/lib/email/send-email.ts` — verbatim port of house's SES `SendEmailCommand` wrapper (rolling-window throttle, multipart body support).
- `site/src/lib/email/loop-protection.ts` — verbatim port (12 in-source tests).
- `site/src/lib/email/find-or-create-thread.ts` — verbatim port (9 in-source tests for `normalize_subject`).
- `site/src/lib/server/send-welcome-email.ts` — real implementation. Sends LD welcome to new user + admin notification ("New Living Dictionaries user: X") in parallel via `Promise.allSettled` so one failure doesn't kill the other.
- `site/src/routes/api/email/render-component-to-html.ts` — verbatim port.
- `site/src/routes/api/email/render-component-to-html.test.ts` — 7 tests verifying OtpEmail / MessageReply / NewUserWelcome render correctly.
- `site/src/routes/api/email/components/BaseLayout.svelte` — LD-themed (color #546e7a, "Living Dictionaries" brand, livingdictionaries.app).
- `site/src/routes/api/email/components/OtpEmail.svelte` — adapted copy.
- `site/src/routes/api/email/components/MessageReply.svelte` — adapted subject default ("A reply from Living Dictionaries").
- `site/src/routes/api/email/components/NewUserWelcome.svelte` — LD copy adapted from `packages/old-site/src/routes/api/email/html/newUserWelcome.ts` (livingtongues.org link, diego@livingtongues.org contact).
- `site/src/lib/db/schemas/shared-migrations/20260526_messages.sql` — `message_threads` + `messages` + `message_attachments` + replaced `process_delete_cascade` trigger to include the message tables.

### Files modified
- `site/src/lib/db/schemas/shared.ts` — added Drizzle definitions for the 3 new tables.
- `site/src/lib/db/sync/types.ts` — added the 3 new tables to `SyncableTableName` + `SYNCABLE_TABLE_NAMES` (FK-safe order: message_threads → messages → message_attachments).
- `site/src/lib/db/server/sync-helpers.ts` — added the 3 new tables to `PRIMARY_KEY` map.
- `site/src/routes/api/auth/email/send-code/+server.ts` — prod branch now renders `OtpEmail.svelte` and calls `send_email` (replaces 503 stub).
- `site/src/routes/api/auth/email/verify/+server.ts` — imports real `send_welcome_email` (replaces stub).
- `site/src/routes/api/auth/google/+server.ts` — imports real `send_welcome_email` (replaces stub).
- `eslint.config.js` — added `ld/email-templates` block disabling `svelte/no-raw-special-elements` for email-components folder.

### Files deleted
- `site/src/lib/server/send-welcome-email-stub.ts` — no longer needed.

### Open env todos
- LD's prod `/opt/hosting/sveltekit/.env`: `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_REGION`, `AWS_SES_SECRET_ACCESS_KEY` (reuse legacy LD's values per migrate-supabase-users-to-new-site.md).

### Deferred to D4
- `lib/email/send-raw-email.ts` — only needed for admin reply (proper `In-Reply-To` + `References` headers via `nodemailer.MailComposer`).
- `lib/email/save-attachment.ts` — only needed for inbound attachment ingest. House doesn't actually have this file yet either; we'll write it when D4's pipeline needs it.

---

## D4 — Inbound email pipeline  ✅ VPS endpoints DONE; CF Worker DEFERRED

### Files added (VPS endpoints — fully functional once CF Worker posts to them)
- `site/src/routes/api/messages/contact/{+server.ts,_call.ts}` — contact-form ingest.
- `site/src/routes/api/messages/email-inbound/+server.ts` — inbound email ingest with threading + attachment-row persistence.
- `site/src/routes/api/messages/reply/{+server.ts,_call.ts}` — admin reply composer. Auth-gated; generates fresh RFC Message-ID, threads via In-Reply-To/References, loop-protection on recipient, persists pending → flips to sent/failed.
- `site/src/lib/email/send-raw-email.ts` — verbatim port of house's SES `SendRawEmailCommand` wrapper using `nodemailer.MailComposer`. Required for custom RFC headers.
- `site/src/lib/r2/put-attachment.ts` — uploads to `R2_ATTACHMENTS_BUCKET` (different from snapshots — admin-private bucket).

### Dependencies added
- `nodemailer@^8.0.7` + `@types/nodemailer@^8.0.0`.

### Open env todos
- LD's prod `/opt/hosting/sveltekit/.env`:
  - `INTERNAL_INGEST_SECRET` — shared with CF Worker.
  - `R2_ATTACHMENTS_BUCKET=livingdictionaries-attachments` (bucket already provisioned).

### Deferred / out-of-scope
- **CF Worker for `livingdictionaries.app` zone** — separate work product (lives in `vps-setup/` or a new `cf-worker/livingdictionaries/`). Worker payload contract is documented on `email-inbound/+server.ts` `MessagesEmailInboundRequestBody`. Worker just needs to: parse MIME (`PostalMime`), upload attachments via R2 bucket binding, POST metadata with `X-Internal-Secret` header.
- **ntfy push notifications** — needs `ntfy_topic` column on `lib/admins.ts` admins; not yet wired.
- **Agent triage hook** — house has `fire_agent_email_inbound` stub; LD doesn't need yet.
- **Admin attachment-download endpoint** — `/api/messages/attachments/[id]` for signed R2 fetch from admin UI; port when admin UI needs it.

---

## D5 — Browser verification

Deferred per parent confirmation (D1 first). If time after D6, run `/test/dict-sync/test-dict-1` manual check.

---

## D6 — Story B.6 PersistedState cache  ✅ COMPLETE

### Files added
- `site/src/lib/me/dictionary-roles.svelte.ts` — client-side reactive cache class (`MyDictionaryRolesCache`). Persists per-user_id to localStorage under `ld_dict_roles_v1_for_user_<id>`. Refreshes on app boot if stale > 1 hour, on manual `refresh()`, on `set_user()` login, drops on `forget()` logout. Server-side returns a fresh instance per render (no SSR cross-tenant leak).

### Files modified
- `site/src/routes/+layout.ts` — wired `get_my_dictionary_roles()` into the layout-load. On login, calls `set_user(id)` + fires `refresh_if_stale()` in the browser. On logout, calls `forget()` which wipes localStorage.

### Behavior
- Components read `page.data.dict_roles.roles` (reactive). The cache surface mirrors house's existing PersistedState patterns.
- Stale-cache trade-off documented in the file: if an admin grants a new role mid-session, the dict is still URL-reachable + push endpoint does fresh role lookup (per Story B.5 in port-db-sync-architecture.md), so security is never affected — just the badge appears one refresh late.

---

## Environment setup — what's done and what Jacob still needs to do

### Done in this session (local dev)
- ✅ `site/.gitignore` updated to permit a committed `.env`.
- ✅ `site/.env` committed with non-secret defaults (`PUBLIC_MODE=dev`, `PUBLIC_GOOGLE_OAUTH_CLIENT_ID`, `AWS_SES_REGION`).
- ✅ `site/.env.local` (gitignored) seeded with random dev `JWT_SECRET` and `INTERNAL_INGEST_SECRET`. AWS_SES + R2 access keys left blank — fill from legacy LD Vercel project if you want real SES + R2 in dev. Without them, dev OTP returns the code inline and SES-sending paths throw a clear error.

### What Jacob needs to do — production env on `ssh living`

Edit `/opt/hosting/sveltekit/.env` on the VPS (the path the docker-compose `env_file:` directive reads). Paste:

```ini
# Mode
PUBLIC_MODE=production

# Auth
JWT_SECRET=<generate fresh: `openssl rand -hex 48`>
PUBLIC_GOOGLE_OAUTH_CLIENT_ID=215143435444-fugm4gpav71r3l89n6i0iath4m436qnv.apps.googleusercontent.com

# AWS SES (carry over from legacy LD Vercel: Settings → Environment Variables)
AWS_SES_ACCESS_KEY_ID=<from Vercel>
AWS_SES_SECRET_ACCESS_KEY=<from Vercel>
AWS_SES_REGION=us-east-2

# Cloudflare R2 — same account as snapshots bucket, two buckets
R2_ACCOUNT_ID=<from CF dashboard>
R2_ACCESS_KEY_ID=<from CF R2 → Manage API Tokens>
R2_SECRET_ACCESS_KEY=<from CF R2 → Manage API Tokens>
R2_SNAPSHOTS_BUCKET=livingdictionaries-snapshots
R2_ATTACHMENTS_BUCKET=livingdictionaries-attachments

# Inbound email pipeline — same secret used by the CF Worker (D4 deferred work product)
INTERNAL_INGEST_SECRET=<generate fresh: `openssl rand -hex 48`>

# Data dir (better-sqlite3 shared.db location inside the container)
DATA_DIR=/data
```

Both the build-time `COPY .env site/.env` and the runtime `env_file: .env`
read from this same file. After updating, `docker compose up -d --build` to
rebuild + restart.

### What Jacob needs to do — Google Cloud Console (BEFORE cutover)

1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) for the project that owns OAuth client `215143435444-fugm4gpav71r3l89n6i0iath4m436qnv.apps.googleusercontent.com`.
2. Click the OAuth 2.0 Client ID to edit.
3. Under **Authorized JavaScript origins**, add:
   - `https://new.livingdictionaries.app`
4. Under **Authorized redirect URIs**: nothing to add for One-Tap (we use the JS-only flow, not server-side OAuth redirect).
5. Save.
6. Leave the existing `https://livingdictionaries.app` origin in place — legacy stays working until DNS cuts over.

### What Jacob needs to do — Google Cloud Console (ON cutover day, AFTER DNS cuts over)

1. Same console page as above.
2. Under **Authorized JavaScript origins**, REMOVE:
   - `https://new.livingdictionaries.app` (this temporary subdomain isn't serving anything after DNS cuts over).
3. Confirm `https://livingdictionaries.app` is still listed — it's now serving the new site.
4. Save.

Added to `.issues/cutover-from-legacy-supabase.md` as an explicit cutover-day step.

---

## Out of scope (deferred to dedicated cutover work)

- Supabase user export → new-site users import (`.issues/migrate-supabase-users-to-new-site.md`).
- R2 pre-warm cron-script for cutover-day (`.issues/cutover-from-legacy-supabase.md`).
- Production dict-page routes (`/[dict_id]/+page.svelte`).
- L9 svelte-pieces (Toasts, Modal) — `/login` page works without them; ports later.

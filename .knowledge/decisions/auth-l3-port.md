# L3 auth port — decisions

Notes that don't belong in code comments but are worth carrying forward when working on LD's new `site/` auth stack.

## Source-of-truth pattern for admin status

`admin_level` is NOT stored in the JWT. It's derived per-request from
`get_admin_level(email)` against the `$lib/admins.ts` allow-list. This means:

- Adding / removing an admin is a one-line edit to `ADMINS` — no JWT rotation
  needed.
- Demoting an admin takes effect on their NEXT request, not 30 days later
  when their token expires.
- The cost: every endpoint that gates on admin status does a lookup against
  the in-memory ADMINS array (free).

The `verify_auth` return shape is intentionally minimal: `{ user_id, email, name }`.
`SsrUser` (in `+layout.server.ts`) enriches with `is_admin` + `admin_level` for
first-paint UI gating; admin-only endpoints call `is_admin(email)` directly.

## Why we kept `unsubscribed_from_emails` as a TEXT timestamp (not INTEGER boolean)

Legacy LD stored `unsubscribed_from_emails TIMESTAMPTZ` (Supabase). We
preserved that shape in `site/src/lib/db/schemas/shared.ts` for two reasons:

1. **Cutover-day migration is 1:1 copy.** No data shape transformation
   needed when bulk-importing Supabase users → new-site users.
2. **"Unsubscribed since when" reporting** for free when admins want it
   later.

The boolean view is derived at the app layer (`!!users.unsubscribed_from_emails`)
and surfaced via `AuthUserData.unsubscribed_from_emails: boolean`.

House uses `INTEGER NOT NULL DEFAULT 0` because it never had a timestamp
column. LD's TEXT-nullable is a deliberate divergence.

## `welcome_email_sent` is obsolete

Legacy LD had a `user_data.welcome_email_sent TIMESTAMPTZ` column because
Supabase Auth didn't tell us cleanly if a user was new. The new
`find_or_create_auth_user` returns `{ user, created: boolean }` which IS the
definitive "first time we've seen this user" signal at insert time. So:

- No `welcome_email_sent` column on `users`.
- OTP-verify and Google-callback fire the welcome email fire-and-forget
  when `created === true`. If SES is down, the user still signs in; we just
  log the failure.
- For robust delivery later (when LD has a job queue), wrap the send in a
  job. No DB flag needed even then — the job itself is the durable record.

## Why `terms_agreement` is NOT a column

Path-A decision: legal coverage via implicit "by signing in you agree to
our Terms" copy in the `/login` footer. No checkbox, no timestamp, no
column, no `/terms` interstitial after first signup. Saves a column + a
route + a gate. Same pattern as Stripe / Linear / Vercel.

If LD ever needs explicit ToS recording (indigenous data sovereignty,
GDPR-style auditable consent), this becomes a follow-up issue + migration.

## SharedWorker auth = cookie-only

Same-origin `fetch()` from a SharedWorker auto-attaches the `session`
cookie. We use `credentials: 'include'` belt-and-braces in case a hosting
setup proxies SharedWorker requests through a different origin.

The `AuthHeaders` interface kept a `bearer?: string` field for future
CLI / non-browser callers. Browser code passes `{}` (empty). The
`x-dev-user-id` / `x-dev-email` headers are gone — `dev-identity.ts` was
deleted along with them when D1 landed.

## OTP rate limits + windowing

- **Send-code endpoint**: max 10 codes / hour / email (`MAX_CODES_PER_EMAIL_PER_HOUR`).
- **Verify endpoint**: max 5 failed attempts / 15-minute rolling window /
  email (`MAX_ATTEMPTS_PER_WINDOW`). In-memory counter — resets on server
  restart, which is acceptable because send-code's cap already bounds the
  attack surface.
- **Code expiry**: 30 minutes.
- **Code length**: 6 digits.

If LD goes multi-process / multi-VPS, the in-memory failed-attempt counter
needs to move to Redis or a DB table. Not relevant on the current
single-process VPS setup.

## Welcome email contents

LD-specific copy adapted from legacy `packages/old-site/src/routes/api/email/html/newUserWelcome.ts`.
Links to:
- `https://livingdictionaries.app` (UTM tagged for analytics)
- `https://livingtongues.org/`
- `mailto:diego@livingtongues.org` for support questions

Fires fire-and-forget via `lib/server/send-welcome-email.ts` which also
sends an admin-list notification ("New Living Dictionaries user: X")
in parallel via `Promise.allSettled` (one failure doesn't kill the other).

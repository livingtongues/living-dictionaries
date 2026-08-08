# Sliding session refresh (LD)

Port of the fleet-wide sliding-session decision (Jacob, 2026-08-07 — tutor/house done in
parallel). Users now stay logged in for **at least 30 days after their LAST visit**, not 30 days
after login.

## What was changed

**`site/src/lib/auth/jwt.ts`**
- `EXPIRY_SECONDS` bumped 30d → **31d** (`60 * 60 * 24 * 31`). Both login endpoints
  (`api/auth/email/verify`, `api/auth/google`) set the `session` cookie `maxAge` from this constant,
  so their cookie lifetime follows automatically.
- Added `REFRESH_AFTER_SECONDS = 60 * 60 * 24` (1 day).
- Added `refresh_jwt_if_stale(token)` (cribbed from tutor): cheap UNVERIFIED `decodeJwt` reads `iat`
  first — a fresh token returns `null` after one base64 decode, no HMAC verify. Only a >1-day-old
  token gets a full `verify_jwt` + re-sign; a token that fails verification returns `null` (no
  refresh). Claims (`sub`/`email`/`name`) are preserved exactly via `verify_jwt` → `sign_jwt`.

**`site/src/hooks.server.ts`**
- Integrated into the EXISTING `handle` (made `async`, no competing export). After the CSRF /
  body-size guards and BEFORE `resolve`: read the `session` cookie, and if
  `refresh_jwt_if_stale` returns a new token, `event.cookies.set('session', …)` with the SAME
  attributes the login endpoints use (`path: '/'`, `httpOnly: true`, `secure: !dev`,
  `sameSite: 'lax'`, `maxAge: EXPIRY_SECONDS`). Set before `resolve` so Set-Cookie rides the
  response.
- Invalid/expired token: left untouched (no cookie delete) — the root `+layout.server.ts` already
  self-clears on verify failure.

## Guarantee

Refresh past 1 day old, re-sign for 31 days ⇒ ≥30 days of validity after any visit, at most one
re-sign per client per day (fresh tokens are skipped by the `iat` gate).

## Verification (all green)

- `pnpm test src/lib/auth/jwt.ts` → **13 passed** (added `refresh_jwt_if_stale` suite: fresh→null,
  <1d→null, >1d re-issues 31d preserving claims, wrong-secret→null, garbage→null; existing
  "sets 31-day expiry" updated).
- `pnpm exec tsc --noEmit` → exit 0.
- `pnpm eslint src/lib/auth/jwt.ts src/hooks.server.ts` → 0 problems (fixed an import-sort error).
- `pnpm check` → 0 errors (50 pre-existing warnings, none in these files).

## Status

Complete. Changes left in the working tree, NOT committed.

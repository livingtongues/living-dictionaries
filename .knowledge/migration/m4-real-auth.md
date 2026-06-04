# M4 · Real auth (JWT + Google + email-OTP + SQLite users/roles)

Replaced the M1 stub (`getSession` → `mock_auth_response`, a logged-in "achi manager") with
real authentication ported from `living-dictionaries-example`. Decisions/gotchas that the code
doesn't make obvious:

## Full port, with two pragmatic LD adaptations
Jacob chose the FULL example model (`AuthUser` class + `ssr_user` + `dict_roles` cache) over a
compat bridge. Two deliberate deviations keep the consumer sweep sane without weakening the model:

- **`page.data.admin` (plain `number`, 0|1|2)** is exposed from the root `+layout.ts` as a
  convenience mirror of `auth_user.user.admin_level`. ~19 components gated on the old
  `Readable<number>` `admin` store; this let the sweep be a pure `$admin`→`admin` strip instead of
  rewriting each to `auth_user.user?.admin_level`. AuthUser stays the source of truth; `admin` is
  recomputed each load (login/logout/dev-toggle all `invalidateAll`).
- **`is_manager`/`is_contributor`/`can_edit` are plain booleans** on the `[dictionaryId]` layout
  (example-exact), derived from `auth_user.user.admin_level` + `dict_roles.roles`. The search
  subsystem (`entries-ui-store`) still wants `Readable`s, so the layout passes `readable(can_edit)`
  / `readable(admin_level)` there only — no churn inside search.

## The legacy `locals.getSession` shim stays (scope boundary)
6 write/media/email endpoints (`db/create-dictionary`, `db/delete-dictionary`, `email/invite`,
`email/new_user`, `gcs_serving_url`, `upload`) still consume the old Supabase `AuthResponse` shape.
They belong to M4-write/M4-media, so instead of rewriting them, `hooks.server.ts` rebuilds that
shape from the REAL session-cookie JWT via `lib/supabase/get-legacy-session.server.ts`
(`.server.ts` so the better-sqlite3 import never reaches the client). Their identity/admin gating
is now real; their actual mutations remain stubbed until M4-write.

## Dev admin-level impersonation (replaces the old "Set Admin Role Level")
The old dev button mutated the mock user's `app_metadata.admin`. In the allow-list world admin
level derives from email, so a dev can't just toggle a number. Re-established via a **dev-only
`dev_admin_level` cookie** (`0|1|2`) honored ONLY when `dev` (or unset → allow-list), applied at
every server admin-resolution point through `lib/server/resolve-admin-level.ts`
(`get_user`, `verify_auth_dict_role`, `+layout.server.ts`, `get-legacy-session`). Endpoint:
`POST /api/auth/dev-admin-level` (404 in prod). **House should mirror this pattern** for its own
admin testing once it moves to an allow-list.

## send-code rate-limit FIX carried from house (and the LD-schema twist)
The example counted `email_codes` rows for the 429 guard, but the "invalidate previous codes"
`DELETE` runs first every call, so the count never exceeds 1 → 429 unreachable. Fixed with house's
**in-memory per-email send-attempt counter** (checked BEFORE the delete). LD twist: LD's
`email_codes.created_at` is `NOT NULL` with no default, so the INSERT must supply it
(`strftime(...)`) — house's INSERT omits it (its schema defaults). Keep the explicit `created_at`.

## e2e against a production `node build` needs an OTP escape hatch
The dev "return the code inline" path is gated on `dev`, which is `false` in `node build` (what
`achi-flow.mjs` boots). Added `E2E_EXPOSE_OTP=true` (read via `$env/dynamic/private`) to also
return the code — explicit, env-gated, never set in real deploys. The e2e boots with that +
`JWT_SECRET` and logs in as the seeded NON-admin `achi-manager@example.com`, proving `can_edit`
comes from a real `dictionary_roles` row (asserts `is_admin=false`/`admin_level=null`), not an
admin bypass. `seed:achi-fixture` now seeds that user + manager role into `shared.db` too.

## `can_edit` cold-cache bug — await roles on first authenticated load
`dict_roles` is a client-side cache fetched async; the root `+layout.ts` originally only
`void`-refreshed it (`refresh_if_stale`). So on the FIRST authenticated load (fresh browser /
just-logged-in, cache cold) the `[dictionaryId]/+layout.ts` computed `can_edit` from an EMPTY roles
array → a real manager saw their dictionary read-only until the next invalidation. Fix: in root
`+layout.ts`, when `browser && ssr_user`, **`await dict_roles.refresh()` when the cache is cold**
(`!fetched_at`) and only background-refresh when warm. Don't instead `await refresh()` inside the
`[dictionaryId]` layout — it races the root's in-flight refresh (`refresh()` early-returns while
`is_loading`), leaving roles empty. Awaiting once in the root (the single refresher) is race-free.
SSR still renders read-only (no client cache server-side) → a brief read-only→editable flash on
hydration, inherent to the client-cached-roles design (matches the example).

## vitest needs a `$env/dynamic/private` alias
`jwt.ts` imports `$env/dynamic/private`; vitest doesn't resolve SvelteKit's `$env/*`. Added an
alias in `vitest.config.ts` → `src/lib/mocks/env-dynamic-private.ts` (`export const env =
process.env`), so the in-source jwt tests can set `process.env.JWT_SECRET`.

## Lockfile: jose added by hand
`jose@^6.2.3` (zero-dependency) added to `dependencies`. A plain `pnpm install` also drifted
`picomatch` 4.0.2→4.0.4 in svelte-check; reverted and hand-added only the 3 jose lockfile entries,
then `--frozen-lockfile` (clean). Honors the lockfile-fidelity rule.

## Env (Jacob owns .env)
`JWT_SECRET` (required to sign/verify) · `PUBLIC_GOOGLE_OAUTH_CLIENT_ID` =
`215143435444-…apps.googleusercontent.com` (same id LD already hardcoded; graceful no-op if unset
so email-OTP + e2e work without it) · `AWS_SES_*` (already present; prod email send only).

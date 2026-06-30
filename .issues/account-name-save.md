# Enable saving the account profile name

The `/account` page's "Your Name" field showed `alert('Saving profile changes will be enabled soon.')`
(M4-write placeholder). Wire it to a real endpoint, matching the shared cross-app convention.

## Reference (house + tutor)
- Both have `POST /api/auth/update-profile` (`+server.ts` + `_call.ts`) — `verify_auth`, validate
  name (trim, max 80, no control chars), `UPDATE users SET name=?, updated_at=? WHERE id=?`, return
  the refreshed `AuthUserData`. Account page calls `api_auth_update_profile({ name })` then
  `auth_user.set_session({ user: data })`.

## LD specifics learned
- `users` is a **READONLY** syncable table in the admin mirror (`READONLY_TABLES` in
  `lib/db/sync/types.ts`) — admin clients only PULL it. Server pull is `updated_at`-based
  (`fetch_changes` selects `WHERE updated_at > watermark`), and the client nulls `dirty` on every
  pulled row. So bumping `updated_at` is all that's needed to propagate; **`users` has NO `dirty`
  column** (unlike `dictionaries`) — do NOT set dirty.
- Refreshed user shape comes from `get_user({ db, user_id, cookies })` (`$lib/server/get-user.ts`),
  same one `/api/auth/me` returns.
- `data.auth_user` on the account page IS the client AuthUser singleton (`get_auth_user()` in
  `+layout.ts`) → `set_session({ user })` updates global reactive state.
- `EditString`'s `<Form>` catches thrown errors and `alert()`s them; settings page instead catches
  in its wrapper and alerts `t('misc.error'): ...`. Follow the settings convention.
- The LD `api-endpoint` skill referenced `api/me/profile/*` as canonical, but that endpoint/test
  never existed → update those stale references to the real `api/auth/update-profile`.

## Tasks
- [x] `src/routes/api/auth/update-profile/+server.ts` — POST, `name` only (extensible sets/values)
- [x] `src/routes/api/auth/update-profile/_call.ts`
- [x] `src/routes/api/auth/update-profile/server.test.ts`
- [x] Wire `/account` `update_name` to the endpoint
- [x] Fix stale `api/me/profile` refs in the api-endpoint skill
- [x] Verify: tsc, lint, test, svelte-check

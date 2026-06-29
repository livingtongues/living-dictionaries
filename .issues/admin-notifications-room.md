# Admin "Notifications" room — system events into Team Chat

## Goal
Stop emailing the admin team for routine system events. Instead post them into a new
**"Notifications" room** in the existing admin Team Chat, which pings each admin by their
**preferred channel** (ntfy / email) via `notify_admin`. Suppress the ping when the action was
taken by an admin (still post the message as a log). Keep all USER-facing emails.

Future-proofing: the room is a normal Team Chat channel so non-admin members can be added later.

## Events to capture
1. **New dictionary created** — `src/routes/api/dictionaries/create/+server.ts`
   - Today: `send_dictionary_emails()` → creator confirmation email + `getAdminRecipients` admin blast.
   - Change: keep creator confirmation; drop admin blast; post to Notifications room. Skip ping if creator is admin (but STILL send the creating admin their own confirmation email).
2. **New user signed up** — `src/routes/api/auth/email/verify/+server.ts` + `src/routes/api/auth/google/+server.ts`
   - Today: `find_or_create_auth_user` returns `{ created }` but it's `void created` (UNUSED — no admin notice at all).
   - Change: when `created`, post to Notifications room. (Signups are public users → ping fires.)
3. **Invite sent (manager/contributor)** — `src/routes/api/email/invite/+server.ts`
   - Today: invitee email + `getAdminRecipients` admin blast (skipped only when inviter is in recipients).
   - Change: keep invitee email; drop admin blast; post to Notifications room. Skip ping if inviter is admin.
   - NOTE: also check `src/routes/api/dictionaries/[id]/roles/+server.ts` (direct role grants) — decide if it counts as an "invite" event.

## Existing building blocks (reuse)
- Chat schema: `src/lib/db/schemas/shared-migrations/20260625d_chat.sql` (chat_rooms / chat_room_members / chat_messages). Server-only, NOT synced; reached via `/api/admin/chat/*` + 5s poll.
- Rooms: `src/lib/admin/chat/rooms.ts` (client-safe ids/names) + `src/lib/server/chat/constants.ts` (`FIXED_CHANNELS`, membership). Add `ROOM_NOTIFICATIONS = 'notifications'`, members `'all'`.
- `post_message()` (chat-db.ts) — requires author membership; `notify_room_message()` (chat-notify.ts) — per-member ping honoring presence + one-ping-per-unread-batch + `notify_admin` channel pref.
- `notify_admin({ email, ... })` (notify-admins.ts) — single targeted ping by the admin's `notify_channel`; no-ops for non-admins + when `NTFY_DISABLED=1`.
- `is_admin(email)` / `ADMINS` (`$lib/admins.ts`) — actor-is-admin gate. Note `notify:false` (Anna) = off-duty.
- `ensure_all_admins_in_team_chat` (ensure-team-membership.ts) — boot membership; extend to add the system bot user + Notifications membership.

## Decisions (CONFIRMED by Jacob)
- D-A ✅ Reuse the chat ping policy (online-skip + one-ping-per-unread-batch) → reuse `ping_room_members`.
- D-B ✅ Admin-initiated events → POST to room but NO ping (`suppress_ping`).
- D-C ✅ Drop the admin email blasts for new-dictionary + invite (keep user-facing emails).
- D-D ✅ Post + ping every brand-new user (`created` flag).
- D-E ✅ "System" bot user authors the messages.
- (auto) Off-duty admins (`notify:false`) are SKIPPED from notification pings — broadcast-style notices. `respect_off_duty: true`.

## DONE ✅
- `rooms.ts`: `ROOM_NOTIFICATIONS = 'notifications'`, `SYSTEM_USER_ID='system'`, `SYSTEM_USER_NAME='System'`, ROOM_NAMES entry.
- `constants.ts`: re-export + `FIXED_CHANNELS` includes notifications (members `'all'`) → admins auto-join via `ensure_my_chat_setup`/boot; room row created at boot.
- `chat-store.svelte.ts` `name_for`: returns "System" for the bot id (not in admin directory).
- `chat-notify.ts`: extracted `ping_room_members({...respect_off_duty})`; `notify_room_message` now delegates to it. Behavior unchanged for chat.
- `notification-email.ts`: `escape_html` exported.
- `notification-messages.ts` (new): pure `format_new_dictionary_notification` / `format_new_user_notification` / `format_invite_notification` → `{ subject, body_text, body_html }` (body_html escapes user input).
- `system-notifier.ts` (new): `post_system_notification({ db, content, base_url, suppress_ping })` — ensures bot user + room membership, posts as System, then `ping_room_members` (respect_off_duty) unless suppressed. Fire-and-forget safe (sync insert before first await).
- Call sites wired with `suppress_ping: is_admin(actor)`:
  - `api/dictionaries/create/+server.ts` (kept creator email; dropped admin blast).
  - `api/email/invite/+server.ts` (kept invitee email; dropped admin blast).
  - `api/auth/email/verify/+server.ts` + `api/auth/google/+server.ts` (on `created`).
- Deleted unused `new_dictionary/composeMessages.ts` + its test; renamed `send_dictionary_emails` → `send_new_dictionary_creator_email` (creator email only).
- Tests: `system-notifier.test.ts` (posts/pings/suppress/off-duty), `notification-messages` inline (escaping), updated `chat-db.ts` room-set assertions.

## Verified
- `pnpm vitest run` → 671 passed / 3 skipped. `pnpm check` → 0 errors. eslint on touched files → clean.
- NOT yet exercised live in a browser (needs dev server + auth). Optional follow-up: trigger create/signup/invite locally and confirm a row in the Notifications room + ping (NTFY_DISABLED in dev).

## Implementation sketch (after answers)
- New `src/lib/server/chat/post-system-notification.ts`: `post_system_notification({ db, body_html, body_text, base_url, suppress_ping })` → ensures system bot user + Notifications membership, `post_message` as system user, then conditionally `notify_room_message` (or a notifications-specific ping fn).
- System bot user: fixed id (e.g. `system`), created idempotently (migration or boot). Must be a member of the Notifications room to post.
- Add `ROOM_NOTIFICATIONS` to `rooms.ts` + `ROOM_NAMES` + `FIXED_CHANNELS` (members `'all'`).
- Wire the 3 call sites; gate ping on `!is_admin(actor_email)`.
- Tests: post-system-notification (posts + pings non-admin actor; posts + no ping for admin actor), and that each call site fires it.

## Verification
- Vitest for the new module + call-site unit tests.
- Local: trigger create-dictionary / signup / invite, confirm a row in the Notifications room (sqlite-query skill) + ping fired (NTFY_DISABLED in dev).

## Part 1 (DONE, separate): gloss-language filter fix
`localizedName` added in EditableGlossesField; `Filter` predicate extracted to `filter-items.ts` + tested.

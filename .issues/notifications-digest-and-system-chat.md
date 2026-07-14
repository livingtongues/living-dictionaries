# Notifications: daily digest, System read-bubble fix, System-posts-to-any-room

Three related asks from Jacob about the admin chat / Notifications room.

## ① Notifications room → daily 8am Pacific digest (was: per-event immediate ping)
The Notifications room currently pings the first platform event immediately, throttles
the rest, and re-pings generically after 24h. Jacob wants ONE daily summary at 8am
Pacific instead ("5 new users and 2 new dictionaries → open notifications"). Nothing
unread → no ping. Regular DMs/channels keep their instant ping (digest is
Notifications-only).

- ✅ `system-notifier.ts`: drop the immediate `ping_room_members` call — post the
      message row only (audit + in-app badge). Remove now-dead `suppress_ping` +
      `base_url` params; update the 4 callers (dictionaries/create, auth/google,
      auth/email/verify, email/invite).
- ✅ `notification-messages.ts`: export markers (NEW_USER / NEW_DICTIONARY / INVITE)
      + pure `summarize_notifications({ messages })` → `{ subject, body_text }`
      (e.g. "5 new users and 2 new dictionaries"). Tests lock each formatter's output
      against its marker so categorization can't drift.
- ✅ New `$lib/db/server/notification-digest-cron.ts`: hourly sweep,
      `building||dev` + `IS_STANDBY` gated + singleton (mirror chat-reping-cron).
      Fire once/day at ≥8am `America/Los_Angeles` (Intl formatToParts), day-guarded in
      `db_metadata` key `notification_digest_last_day`. Per on-duty admin member of
      `notifications` room with unread system messages → `notify_user` a summary. Skip
      off-duty (`notify:false`), skip when nothing unread. Leave read positions
      untouched (day-guard prevents dupes).
- ✅ `chat-reping-cron.ts`: exclude `ROOM_NOTIFICATIONS` from the gentle re-ping
      (belt-and-suspenders — stale `last_notified_at` rows shouldn't re-ping).
- ✅ Wire `start_notification_digest_cron_once()` in hooks.server.ts.

## ② System read-receipt bubble (funny)
`post_message` marks the AUTHOR read; System authors every notification, so it gets a
`last_read_at` and shows a read-receipt bubble parked on the latest message.
- ✅ `chat-db.ts` `get_room_read_positions`: `AND user_id != <system>` — the single
      chokepoint feeding the bubbles. Update its test.

## ③ System posts into ANY room (labeled System), pings members normally
Jacob's agent (me) posts as System into e.g. Greg+Jacob's DM so Greg knows it's the
agent, not Jacob — and Greg gets his normal ping. Past attempt failed because
`post_message` → `require_member` threw (System isn't a DM member). Pings need the
SvelteKit runtime (SES/ntfy), so a raw SQL insert alone can't ping. Solution: a tiny
**outbox** I insert a row into (dev `.data/shared.db` / prod `docker exec node`), drained
by a fast server cron that posts + pings — no API route, no auth, no cookie-minting.

- ✅ Migration `20260714_chat_system_outbox.sql`: `chat_system_outbox` (id, room_id,
      body_html, body_text, skip_user_id, created_at, processed_at, error) + pending
      partial index. (Chat tables are raw — no Drizzle schema entry needed.)
- ✅ `chat-db.ts` `post_message`: skip `require_member` when `user_id === SYSTEM_USER_ID`
      (server-only; clients never pass a system id). It never joins the room → DM
      title/members stay two-person.
- ✅ `chat-notify.ts`: add optional `skip_user_ids` to `ping_room_members` +
      `notify_room_message` (so the on-behalf-of human isn't pinged for their own agent's msg).
- ✅ New `$lib/server/chat/system-outbox.ts`: `process_system_outbox({ db, base_url })`
      — drain pending rows: `post_message` as System + `notify_room_message` (skip
      skip_user_id), stamp processed_at/error. Tests.
- ✅ New `$lib/db/server/system-outbox-cron.ts`: ~20s sweep, gated like the others.
- ✅ Wire in hooks.server.ts.
- ✅ `.claude/commands/system-chat.md`: how I resolve a room_id (DM `dm:<sorted ids>`
      or by name/members) + insert an outbox row (dev + prod snippets), skip_user_id =
      the human I'm acting for (Jacob) so he isn't pinged.

## Verify
`pnpm test` (new pure/cron/outbox tests), `tsc`, `pnpm lint`, `pnpm check`.

## Notes / decisions
- Daily digest is Notifications-only (Jacob Q1). System posts DO ping members (Jacob Q2:
  "just like me writing it").
- No admin levels / API for ③ — I control the DB; slash command + row insert (Jacob Q3).
- Crons are `building||dev`-dormant, so dev verification is via unit tests + manual
  sweep calls, not the live timers.

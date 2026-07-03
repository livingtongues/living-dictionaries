/**
 * Room/system identifiers are client-safe and live in `$lib/chat/constants`
 * (the /chat page imports them too); re-exported here so server code has one
 * import site. The rest below is server-only.
 *
 * Channels are DB-managed `chat_rooms` rows (see chat-db.ts `create_channel`
 * etc.) — there is no fixed channel list in source anymore. The two system
 * rooms (`all-admins`, `notifications`) are seeded + admin-joined at boot by
 * `ensure_all_admins_in_team_chat`.
 */
export {
  ROOM_ALL_ADMINS,
  ROOM_NOTIFICATIONS,
  SYSTEM_ROOM_IDS,
  SYSTEM_USER_ID,
  SYSTEM_USER_NAME,
} from '$lib/chat/constants'

/** A member counts as "online" (→ suppress external ping) if seen within this window. */
export const PRESENCE_WINDOW_MS = 60_000

/** Newest-first page size for the message list / poll. */
export const MESSAGE_PAGE_LIMIT = 100

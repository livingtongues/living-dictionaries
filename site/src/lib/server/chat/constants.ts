/**
 * Room ids + display names are client-safe and live in `$lib/admin/chat/rooms`
 * (the Team page imports them too); re-exported here so server code has one
 * import site. The rest below is server-only.
 */
import {
  ROOM_ALL_ADMINS,
  ROOM_ANNA_GREG_JACOB,
  ROOM_DIEGO_ANNA_GREG,
} from '$lib/admin/chat/rooms'

export {
  ROOM_ALL_ADMINS,
  ROOM_ANNA_GREG_JACOB,
  ROOM_DIEGO_ANNA_GREG,
  ROOM_NAMES,
} from '$lib/admin/chat/rooms'

/**
 * FIXED-membership channel rooms. `members: 'all'` = every allow-listed admin;
 * otherwise an explicit email list (emails mirror `$lib/admins.ts`). Upserted +
 * joined lazily by `ensure_my_chat_setup` on every chat-API hit, and eagerly at
 * boot by `ensure_all_admins_in_team_chat`.
 */
export interface FixedChannel {
  id: string
  members: 'all' | readonly string[]
}

export const FIXED_CHANNELS: readonly FixedChannel[] = [
  { id: ROOM_ALL_ADMINS, members: 'all' },
  { id: ROOM_ANNA_GREG_JACOB, members: ['dictionaries@livingtongues.org', 'livingtongues@gmail.com', 'jwrunner7@gmail.com'] },
  { id: ROOM_DIEGO_ANNA_GREG, members: ['diego@livingtongues.org', 'dictionaries@livingtongues.org', 'livingtongues@gmail.com'] },
]

/** An admin counts as "online" (→ suppress external ping) if seen within this window. */
export const PRESENCE_WINDOW_MS = 60_000

/** Newest-first page size for the message list / poll. */
export const MESSAGE_PAGE_LIMIT = 100

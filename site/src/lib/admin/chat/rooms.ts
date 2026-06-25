/**
 * Client-safe chat room identifiers + display names. These are NOT sensitive,
 * so they live outside `$lib/server/` and can be imported by the Team page /
 * client code. The server constants module (`$lib/server/chat/constants.ts`)
 * re-exports these and adds the server-only values (FIXED_CHANNELS membership,
 * presence window, page size).
 */
export const ROOM_ALL_ADMINS = 'all-admins'
export const ROOM_ANNA_GREG_JACOB = 'anna-greg-jacob'
export const ROOM_DIEGO_ANNA_GREG = 'diego-anna-greg'

export const ROOM_NAMES: Record<string, string> = {
  [ROOM_ALL_ADMINS]: 'All Admins',
  [ROOM_ANNA_GREG_JACOB]: 'Anna, Greg & Jacob',
  [ROOM_DIEGO_ANNA_GREG]: 'Diego, Anna & Greg',
}

/** Per-file upload ceiling for chat attachments (matches the message-attachment limit). */
export const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024
/** Most files allowed on a single message. */
export const MAX_CHAT_ATTACHMENTS_PER_MESSAGE = 10

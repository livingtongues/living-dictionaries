/**
 * Client-safe chat constants. These are NOT sensitive, so they live outside
 * `$lib/server/` and can be imported by the /chat page / client code. The
 * server constants module (`$lib/server/chat/constants.ts`) re-exports these
 * and adds the server-only values (presence window, page size).
 *
 * Channels are DB-managed rows (created + administered in the /chat UI) —
 * only the SYSTEM room keeps a well-known id the code needs to reference.
 */

/**
 * System-notifications channel. The server's System bot posts platform events
 * (new dictionary / new user / invite sent) here. Membership is UI-managed
 * (admins add whoever should receive the feed). Carries platform telemetry.
 */
export const ROOM_NOTIFICATIONS = 'notifications'
/** The system room can't be deleted; like all admin rooms it's only manageable by super admins. */
export const SYSTEM_ROOM_IDS = [ROOM_NOTIFICATIONS] as const

/**
 * The System bot that authors notification messages. A real `users` row (so the
 * NOT-NULL `chat_messages.author_user_id` FK resolves) but never a person, so it
 * never appears in the member directory / DM picker — `name_for` resolves its
 * display name from this constant instead.
 */
export const SYSTEM_USER_ID = 'system'
export const SYSTEM_USER_NAME = 'System'

/** Per-file upload ceiling for chat attachments (matches the message-attachment limit). */
export const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024
/** Most files allowed on a single message. */
export const MAX_CHAT_ATTACHMENTS_PER_MESSAGE = 10

/**
 * Newest-first page size for the message list / poll / load-older paging. Not
 * sensitive, so it's client-safe here (the /chat page reads it to decide when
 * more history may exist); the server constants module re-exports it.
 */
export const MESSAGE_PAGE_LIMIT = 100

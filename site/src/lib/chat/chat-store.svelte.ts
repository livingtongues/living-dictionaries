/**
 * Singleton client store for the chat. Holds the room list + member directory
 * and drives two background loops:
 *
 * - `start_rooms_poll()` — low-frequency room/unread refresh. Runs app-wide for
 *   every chat member (root layout) so the avatar unread dot + UserMenu badge
 *   stay live anywhere on the site.
 * - `start_presence()` / `stop_presence()` — the presence heartbeat that marks
 *   the user "online" (suppresses email/ntfy pings). Deliberately ONLY runs on
 *   /chat and inside /admin — a partner merely browsing the site should still
 *   get pinged, since the unread dot is subtle.
 *
 * The /chat page itself adds the faster per-room message poll.
 */
import type { ChatDirectoryEntry, RoomSummary } from '$lib/server/chat/chat-db'
import { api_chat_heartbeat } from '$api/chat/heartbeat/_call'
import { api_chat_rooms } from '$api/chat/rooms/_call'
import { SYSTEM_USER_ID, SYSTEM_USER_NAME } from './constants'

const ROOMS_POLL_MS = 30_000
const HEARTBEAT_MS = 20_000

class ChatStore {
  rooms = $state<RoomSummary[]>([])
  directory = $state<ChatDirectoryEntry[]>([])
  me_user_id = $state('')
  me_admin_level = $state(0)
  loaded = $state(false)
  /** The room the user is currently viewing (sent with the heartbeat). */
  current_room_id = $state<string | null>(null)

  total_unread = $derived(this.rooms.reduce((sum, room) => sum + room.unread, 0))

  #rooms_timer: ReturnType<typeof setInterval> | null = null
  #presence_timer: ReturnType<typeof setInterval> | null = null

  async refresh_rooms(): Promise<void> {
    const { data } = await api_chat_rooms()
    if (!data)
      return
    this.rooms = data.rooms
    this.directory = data.directory
    this.me_user_id = data.me.user_id
    this.me_admin_level = data.me.admin_level
    this.loaded = true
  }

  async heartbeat(): Promise<void> {
    await api_chat_heartbeat({ room_id: this.current_room_id })
  }

  name_for(user_id: string): string {
    if (user_id === SYSTEM_USER_ID)
      return SYSTEM_USER_NAME
    const entry = this.directory.find(member => member.user_id === user_id)
    return entry?.name || entry?.email || 'Unknown'
  }

  /** Order a room's members for display: others first (in directory order), me last. */
  ordered_member_ids(member_ids: string[]): string[] {
    const directory_index = (user_id: string): number => {
      const index = this.directory.findIndex(member => member.user_id === user_id)
      return index === -1 ? Number.MAX_SAFE_INTEGER : index
    }
    return [...member_ids].sort((a, b) => {
      if (a === this.me_user_id)
        return 1
      if (b === this.me_user_id)
        return -1
      return directory_index(a) - directory_index(b)
    })
  }

  room_title(room: Pick<RoomSummary, 'kind' | 'name' | 'member_ids'>): string {
    if (room.kind === 'channel')
      return room.name ?? 'Channel'
    const other = room.member_ids.find(id => id !== this.me_user_id)
    return other ? this.name_for(other) : 'Direct message'
  }

  /** App-wide unread refresh for chat members. Singleton — safe to call repeatedly. */
  start_rooms_poll(): void {
    if (this.#rooms_timer)
      return
    void this.refresh_rooms()
    this.#rooms_timer = setInterval(() => {
      void this.refresh_rooms()
    }, ROOMS_POLL_MS)
  }

  stop_rooms_poll(): void {
    if (this.#rooms_timer) {
      clearInterval(this.#rooms_timer)
      this.#rooms_timer = null
    }
  }

  /** Presence heartbeat — ONLY while on /chat or inside /admin (see module docs). */
  start_presence(): void {
    if (this.#presence_timer)
      return
    void this.heartbeat()
    this.#presence_timer = setInterval(() => {
      void this.heartbeat()
    }, HEARTBEAT_MS)
  }

  stop_presence(): void {
    if (this.#presence_timer) {
      clearInterval(this.#presence_timer)
      this.#presence_timer = null
    }
  }
}

export const chat_store = new ChatStore()

/**
 * Singleton client store for the admin team chat. Holds the room list + admin
 * directory and drives the low-frequency background poll (room/unread refresh +
 * presence heartbeat) that runs app-wide from the admin layout — so the "Team"
 * nav unread badge and presence stay live even when you're not on the Team page.
 * The Team page itself adds the faster per-room message poll.
 */
import type { AdminDirectoryEntry } from '$lib/server/chat/api'
import type { RoomSummary } from '$lib/server/chat/chat-db'
import { api_admin_chat_heartbeat } from '$api/admin/chat/heartbeat/_call'
import { api_admin_chat_rooms } from '$api/admin/chat/rooms/_call'
import { SYSTEM_USER_ID, SYSTEM_USER_NAME } from './rooms'

const BACKGROUND_POLL_MS = 20_000

class ChatStore {
  rooms = $state<RoomSummary[]>([])
  admins = $state<AdminDirectoryEntry[]>([])
  me_user_id = $state('')
  loaded = $state(false)
  /** The room the user is currently viewing (sent with the heartbeat). */
  current_room_id = $state<string | null>(null)

  total_unread = $derived(this.rooms.reduce((sum, room) => sum + room.unread, 0))

  #bg_timer: ReturnType<typeof setInterval> | null = null

  async refresh_rooms(): Promise<void> {
    const { data } = await api_admin_chat_rooms()
    if (!data)
      return
    this.rooms = data.rooms
    this.admins = data.admins
    this.me_user_id = data.me.user_id
    this.loaded = true
  }

  async heartbeat(): Promise<void> {
    await api_admin_chat_heartbeat({ room_id: this.current_room_id })
  }

  name_for(user_id: string): string {
    if (user_id === SYSTEM_USER_ID)
      return SYSTEM_USER_NAME
    return this.admins.find(admin => admin.user_id === user_id)?.name ?? 'Unknown'
  }

  room_title(room: Pick<RoomSummary, 'kind' | 'name' | 'member_ids'>): string {
    if (room.kind === 'channel')
      return room.name ?? 'Channel'
    const other = room.member_ids.find(id => id !== this.me_user_id)
    return other ? this.name_for(other) : 'Direct message'
  }

  start_background(): void {
    if (this.#bg_timer)
      return
    void this.refresh_rooms()
    void this.heartbeat()
    this.#bg_timer = setInterval(() => {
      void this.refresh_rooms()
      void this.heartbeat()
    }, BACKGROUND_POLL_MS)
  }

  stop_background(): void {
    if (this.#bg_timer) {
      clearInterval(this.#bg_timer)
      this.#bg_timer = null
    }
  }
}

export const chat_store = new ChatStore()

import type { ChatDirectoryEntry, RoomSummary } from '$lib/server/chat/chat-db'
import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { AuthUser } from '$lib/auth/user.svelte'
import { chat_store } from '$lib/chat/chat-store.svelte'

/**
 * The in-admin door: the SAME ChatPage, with `chrome="admin"` — no <Header>, no
 * gate screens (the admin layout owns both), and it fills its flex parent
 * instead of measuring the viewport.
 */
const now = '2026-07-03T15:30:00.000Z'

const directory: ChatDirectoryEntry[] = [
  { user_id: 'u-jacob', name: 'Jacob Bowdoin', email: 'jacob@example.com', online: true },
  { user_id: 'u-diego', name: 'Diego Córdova', email: 'diego@example.com', online: true },
  { user_id: 'u-greg', name: 'Dr. Greg Anderson', email: 'greg@example.com', online: false },
]

function room(overrides: Partial<RoomSummary> & Pick<RoomSummary, 'id' | 'name' | 'member_ids'>): RoomSummary {
  return {
    kind: 'channel',
    admin_room: false,
    can_manage: false,
    updated_at: now,
    unread: 0,
    last_message: null,
    online_member_ids: [],
    ...overrides,
  } as RoomSummary
}

chat_store.me_user_id = 'u-jacob'
chat_store.me_admin_level = 3
chat_store.directory = directory
chat_store.rooms = [
  room({ id: 'notifications', name: 'Notifications', admin_room: true, can_manage: true, member_ids: ['u-jacob', 'u-diego', 'u-greg'], online_member_ids: ['u-jacob', 'u-diego'] }),
  room({ id: 'diego-greg-jacob', name: 'Diego, Greg & Jacob', can_manage: true, member_ids: ['u-jacob', 'u-diego', 'u-greg'], unread: 3 }),
]
chat_store.loaded = true

function admin_user() {
  const auth_user = new AuthUser()
  auth_user.set_session({
    user: {
      id: 'u-jacob',
      email: 'jacob@example.com',
      name: 'Jacob Bowdoin',
      avatar_url: null,
      created_at: '2024-01-15T00:00:00Z',
      is_admin: true,
      admin_level: 3 as never,
      is_chat_member: true,
      translator_locales: [],
      preferred_locale: null,
      unsubscribed_from_emails: false,
    },
  })
  return auth_user
}

export const shared_meta: StoryMeta = {
  flavors: false,
}

export const AdminDoor: PageStory<typeof Component> = {
  csr: true,
  viewports: [{ width: 1000, height: 520 }],
  page_data: { auth_user: admin_user(), t: ((key: string) => key) as never },
}

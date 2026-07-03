import type { ChatDirectoryEntry, RoomSummary } from '$lib/server/chat/chat-db'
import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { AuthUser } from '$lib/auth/user.svelte'
import { chat_store } from '$lib/chat/chat-store.svelte'

// The page reads everything off the `chat_store` singleton (rooms come from an
// API the story harness can't reach). Module scope seeds the default (partner)
// view; admin stories reseed via the `window.__ld_seed_chat_story` hook in
// their interactions (the store is $state, so reassignment just rerenders).
const now = '2026-07-03T15:30:00.000Z'

const directory: ChatDirectoryEntry[] = [
  { user_id: 'u-jacob', name: 'Jacob Bowdoin', email: 'jacob@example.com', online: true },
  { user_id: 'u-diego', name: 'Diego Córdova', email: 'diego@example.com', online: true },
  { user_id: 'u-greg', name: 'Dr. Greg Anderson', email: 'greg@example.com', online: false },
  { user_id: 'u-partner', name: 'Pat Partner', email: 'partner@example.com', online: false },
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

interface SeedConfig {
  me_user_id: string
  admin_level: number
  directory: ChatDirectoryEntry[]
  rooms: RoomSummary[]
}

function seed_store({ me_user_id, admin_level, directory: seeded_directory, rooms }: SeedConfig) {
  chat_store.me_user_id = me_user_id
  chat_store.me_admin_level = admin_level
  chat_store.directory = seeded_directory
  chat_store.rooms = rooms
  chat_store.loaded = true
}

// A partner's directory only contains co-members of their one channel.
const partner_seed: SeedConfig = {
  me_user_id: 'u-partner',
  admin_level: 0,
  directory: directory.filter(entry => ['u-jacob', 'u-partner'].includes(entry.user_id)),
  rooms: [
    room({ id: 'partners', name: 'Yawalapiti project', member_ids: ['u-jacob', 'u-partner'], online_member_ids: ['u-jacob'] }),
  ],
}

const super_admin_seed: SeedConfig = {
  me_user_id: 'u-jacob',
  admin_level: 3,
  directory,
  rooms: [
    room({ id: 'all-admins', name: 'All Admins', admin_room: true, can_manage: true, member_ids: ['u-jacob', 'u-diego', 'u-greg'], online_member_ids: ['u-jacob', 'u-diego'] }),
    room({ id: 'partners', name: 'Yawalapiti project', can_manage: true, member_ids: ['u-jacob', 'u-partner'], unread: 2 }),
  ],
}

const admin_view_seed: SeedConfig = {
  me_user_id: 'u-jacob',
  admin_level: 2,
  directory,
  rooms: [
    room({ id: 'all-admins', name: 'All Admins', admin_room: true, member_ids: ['u-jacob', 'u-diego', 'u-greg'], online_member_ids: ['u-diego'] }),
  ],
}

// Default (module-load) seed + the reseed hook admin stories call from Puppeteer.
seed_store(partner_seed)
const seeds: Record<string, SeedConfig> = { partner: partner_seed, super_admin: super_admin_seed, admin_view: admin_view_seed }
if (typeof window !== 'undefined')
  (window as unknown as { __ld_seed_chat_story: (name: string) => void }).__ld_seed_chat_story = (name: string) => seed_store(seeds[name])

function user({ is_admin = true, admin_level = 3, is_chat_member = true } = {}) {
  const auth_user = new AuthUser()
  auth_user.set_session({
    user: {
      id: 'u-jacob',
      email: 'jacob@example.com',
      name: 'Jacob Bowdoin',
      avatar_url: null,
      created_at: '2024-01-15T00:00:00Z',
      is_admin,
      admin_level: admin_level as never,
      is_chat_member,
      translator_locales: [],
      preferred_locale: null,
      unsubscribed_from_emails: false,
    },
  })
  return auth_user
}

const t = ((key: string) => key) as never

export const shared_meta: StoryMeta = {
  flavors: false,
}

/**
 * Super admin: manageable admin room active → members popover shows remove
 * buttons, the add-member search, and rename/delete; sidebar has New channel.
 */
export const SuperAdminManage: PageStory<typeof Component> = {
  csr: true,
  viewports: [{ width: 1000, height: 560 }],
  page_data: { auth_user: user(), t },
  interactions: async (page) => {
    await page.evaluate(() => (window as unknown as { __ld_seed_chat_story: (name: string) => void }).__ld_seed_chat_story('super_admin'))
    await page.waitForSelector('.members-btn')
    await page.click('.members-btn')
    await page.waitForSelector('.members-pop')
  },
}

/** Level-2 admin on an admin room: members popover is view/DM-only (no manage). */
export const AdminViewOnly: PageStory<typeof Component> = {
  csr: true,
  viewports: [{ width: 1000, height: 520 }],
  page_data: { auth_user: user({ admin_level: 2 }), t },
  interactions: async (page) => {
    await page.evaluate(() => (window as unknown as { __ld_seed_chat_story: (name: string) => void }).__ld_seed_chat_story('admin_view'))
    // The default (partner) seed auto-selected a room this seed doesn't have — pick All Admins.
    await page.waitForSelector('.room-btn')
    await page.click('.room-btn')
    await page.waitForSelector('.members-btn')
    await page.click('.members-btn')
    await page.waitForSelector('.members-pop')
  },
}

/** A partner (non-admin member): one channel, no New-channel button, DM picker from co-members. */
export const Partner: PageStory<typeof Component> = {
  csr: true,
  viewports: [{ width: 900, height: 480 }, { width: 375, height: 640 }],
  page_data: { auth_user: user({ is_admin: false, admin_level: 0 }), t },
}

/** Signed in but not in any channel → invite-only gate. */
export const NotAMember: PageStory<typeof Component> = {
  viewports: [{ width: 700, height: 400 }],
  page_data: { auth_user: user({ is_admin: false, admin_level: 0, is_chat_member: false }), t },
}

/** Signed out → sign-in prompt. */
export const SignedOut: PageStory<typeof Component> = {
  viewports: [{ width: 700, height: 400 }],
  page_data: { auth_user: { user: null }, t },
}

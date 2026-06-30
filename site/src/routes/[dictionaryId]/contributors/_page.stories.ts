import { readable } from 'svelte/store'
import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t },
}

const noop = async () => {}

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  public: true,
  con_language_description: '',
  hide_living_tongues_logo: 0,
  write_in_collaborators: ['Elder storytellers of the highland villages'],
  citation: '',
}

const editor_edits = {
  inviteHelper: () => noop,
  removeContributor: () => noop,
  cancelInvite: () => noop,
  writeInCollaborator: noop,
  removeWriteInCollaborator: () => noop,
}

const partner_edits = {
  add_partner_name: noop,
  delete_partner: noop,
  add_partner_image: () => readable({ progress: 0, preview_url: '' }),
  delete_partner_image: noop,
  hide_living_tongues_logo: noop,
}

const shared_props = {
  dictionary,
  editor_edits,
  partner_edits,
  update_citation: noop,
  managers: [{ user_id: 'u1', full_name: 'Anna Luisa Daigneault' }],
  contributors: [
    { user_id: 'u2', id: 'role2', full_name: 'María López' },
    { user_id: 'u3', id: 'role3', full_name: '' },
  ],
  partners: [],
  invites: [],
} as never

export const Viewer: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: false, is_contributor: false, auth_user: { admin_level: 0 } } as never,
}

export const Manager: PageStory<typeof Component> = {
  props: { ...(shared_props as object), is_manager: true, is_contributor: false, auth_user: { admin_level: 0 } } as never,
}

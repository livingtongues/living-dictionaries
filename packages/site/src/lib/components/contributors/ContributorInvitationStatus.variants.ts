import type { Variant, VariantMeta } from 'kitbook'
import type Component from './ContributorInvitationStatus.svelte'

export const shared_meta: VariantMeta = {
  viewports: [
    { width: 320, height: 100 },
  ],
  languages: [],
}

const shared = {} satisfies Partial<Variant<Component>>

export const First: Variant<Component> = {
  ...shared,
  invite: {
    id: 'randomid1234',
    targetEmail: 'jimbob@gmail.com',
    inviterEmail: 'jimcousin@gmail.com',
  },
  on_delete_invite: null,
}

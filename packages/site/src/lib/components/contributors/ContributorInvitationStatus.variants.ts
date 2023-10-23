import type { Variant, Viewport } from 'kitbook'
import type Component from './ContributorInvitationStatus.svelte'

export const viewports: Viewport[] = [
  { width: 320, height: 200}
]

export const variants: Variant<Component>[] = [
  {
    name: 'Situation A',
    description: 'Add optional information about this variant',
    props: {
      invite: {
        id: 'randomid1234',
        targetEmail: 'jimbob@gmail.com',
        inviterEmail: 'jimcousin@gmail.com',
      }
    },
  },
]

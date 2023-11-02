import type { Variant, Viewport } from 'kitbook'
import type Component from './ContributorInvitationStatus.svelte'

export const viewports: Viewport[] = [
  { width: 320, height: 100}
]

export const languages = []

export const variants: Variant<Component>[] = [
  {
    props: {
      invite: {
        id: 'randomid1234',
        targetEmail: 'jimbob@gmail.com',
        inviterEmail: 'jimcousin@gmail.com',
      }
    },
  },
]

import type { Readable } from 'svelte/store'
import type { DictionaryView, IHelper, IInvite } from '@living-dictionaries/types'

type DictionaryWithHelperStores = DictionaryView & {
  managers: Readable<IHelper[]>
  contributors: Readable<IHelper[]>
  writeInCollaborators: Readable<IHelper[]>
  invites: Readable<IInvite[]>
  getManagers: Promise<IHelper[]>
  getContributors: Promise<IHelper[]>
  getWriteInCollaborators: Promise<IHelper[]>
  getInvites: Promise<IInvite[]>
}

type DictionaryWithHelpers = DictionaryView & {
  managers: IHelper[]
  contributors: IHelper[]
  writeInCollaborators: IHelper[]
  invites: IInvite[]
}

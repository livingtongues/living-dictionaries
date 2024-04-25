import { setOnline, updateOnline } from 'sveltefirets'
import { getDocumentOrError } from 'sveltefirets/firestore/firestore.js'
import { serverTimestamp } from 'firebase/firestore/lite'
import type { IHelper, IInvite, IUser } from '@living-dictionaries/types'

import { get } from 'svelte/store'

export async function load({ params: { inviteId, dictionaryId }, parent }) {
  async function accept_invite(role: 'manager' | 'contributor') {
    const { t, user } = await parent()

    try {
      const $user = get(user)
      const contributor: IHelper = {
        id: $user.uid,
        name: $user.displayName,
      }

      const collectionPath = `dictionaries/${dictionaryId}/${
        role === 'manager' ? 'managers' : 'contributors'
      }/${$user.uid}`
      await setOnline<IHelper>(collectionPath, contributor)

      await updateOnline<IInvite>(`dictionaries/${dictionaryId}/invites/${inviteId}`, {
        status: 'claimed',
      })

      await updateOnline<IUser>(`users/${$user.uid}`, {
        termsAgreement: serverTimestamp(),
      })
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  const { data: invite, error } = await getDocumentOrError<IInvite>(`dictionaries/${dictionaryId}/invites/${inviteId}`)
  if (error) {
    console.error(error)
  }

  return { invite, accept_invite }
}

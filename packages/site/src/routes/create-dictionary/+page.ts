import { docExists, firebaseConfig, setOnline, updateOnline } from 'sveltefirets'
import { arrayUnion, serverTimestamp } from 'firebase/firestore/lite'
import type { IHelper, IUser, TablesInsert } from '@living-dictionaries/types'
import { get } from 'svelte/store'
import type { PageLoad } from './$types'
import { pruneObject } from '$lib/helpers/prune'
import { api_create_dictionary } from '$api/db/create-dictionary/_call'

export const load = (({ parent }) => {
  const MIN_URL_LENGTH = 3

  async function dictionary_with_url_exists(url: string): Promise<boolean> {
    return await docExists(`dictionaries/${url}`)
  }

  async function create_dictionary(dictionary: Omit<TablesInsert<'dictionaries'>, 'created_by' | 'updated_by'>) {
    const { t, user } = await parent()
    const $user = get(user)
    if (!$user) return alert('Please login first') // this should never fire as should be caught in page

    if (dictionary.id.length < MIN_URL_LENGTH) {
      return alert(t('create.choose_different_url'))
    }

    try {
      const pruned_dictionary = pruneObject(dictionary)
      if (firebaseConfig.projectId === 'talking-dictionaries-dev') {
        console.info(pruned_dictionary)
        if (!confirm('Dictionary value logged to console because in dev mode. Do you still want to create this dictionary?')) {
          return
        }
      }

      const { error } = await api_create_dictionary({ dictionary: pruned_dictionary, fb_user: $user })
      if (error)
        throw new Error(error.message)

      await setOnline<IHelper>(`dictionaries/${dictionary.id}/managers/${$user.uid}`, {
        id: $user.uid,
        name: $user.displayName,
      })
      await updateOnline<IUser>(`users/${$user.uid}`, {
        managing: arrayUnion(dictionary.id),
        termsAgreement: serverTimestamp(),
      })

      window.location.replace(`/${dictionary.id}/entries`)
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }
  return {
    MIN_URL_LENGTH,
    dictionary_with_url_exists,
    create_dictionary,
  }
}) satisfies PageLoad

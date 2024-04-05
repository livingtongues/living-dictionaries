import { authState, docExists, firebaseConfig, setOnline, updateOnline } from 'sveltefirets'
import { arrayUnion, serverTimestamp } from 'firebase/firestore/lite'
import type { IDictionary, IHelper, IUser } from '@living-dictionaries/types'
import { get } from 'svelte/store'
import type { PageLoad } from './$types'
import { post_request } from '$lib/helpers/get-post-requests'
import { pruneObject } from '$lib/helpers/prune'
import type { NewDictionaryRequestBody } from '$api/email/new_dictionary/+server'

export const load = (({ parent }) => {
  const MIN_URL_LENGTH = 3

  async function dictionary_with_url_exists(url: string): Promise<boolean> {
    return await docExists(`dictionaries/${url}`)
  }

  async function createNewDictionary(dictionary: IDictionary, url: string) {
    const { t, user } = await parent()
    const $user = get(user)
    if (!$user) return alert('Login first') // this should never fire as should be caught in page

    const is_in_use = await dictionary_with_url_exists(url)
    if (is_in_use || url.length < MIN_URL_LENGTH) {
      return alert(t('create.choose_different_url'))
    }
    try {
      const prunedDictionary = pruneObject(dictionary)
      if (firebaseConfig.projectId === 'talking-dictionaries-dev') {
        console.info(prunedDictionary)
        if (
          !confirm(
            'Dictionary value logged to console because in dev mode. Do you still want to create this dictionary?',
          )
        )
          return
      }

      await setOnline<IDictionary>(`dictionaries/${url}`, prunedDictionary)
      await setOnline<IHelper>(`dictionaries/${url}/managers/${$user.uid}`, {
        id: $user.uid,
        name: $user.displayName,
      })
      await updateOnline<IUser>(`users/${$user.uid}`, {
        managing: arrayUnion(url),
        termsAgreement: serverTimestamp(),
      })

      const auth_state_user = get(authState)
      const auth_token = await auth_state_user.getIdToken()
      await post_request<NewDictionaryRequestBody, null>('/api/email/new_dictionary', {
        auth_token,
        dictionary: { ...prunedDictionary, id: url },
      })

      window.location.replace(`/${url}/entries/list`)
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }
  return {
    MIN_URL_LENGTH,
    dictionary_with_url_exists,
    createNewDictionary,
  }
}) satisfies PageLoad

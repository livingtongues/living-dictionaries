import type { PageLoad } from './$types'
import { pruneObject } from '$lib/helpers/prune'
import { api_dictionaries_create } from '$api/dictionaries/create/_call'
import type { DictionariesCreateRequestBody } from '$api/dictionaries/create/+server'
import { api_dictionaries_id_exists } from '$api/dictionaries/[id]/_call'

const mode = import.meta.env.MODE as 'development' | 'production'

export const load = (({ parent }) => {
  const MIN_URL_LENGTH = 3

  function dictionary_id_exists(url: string): Promise<boolean> {
    return api_dictionaries_id_exists(url)
  }

  async function create_dictionary(dictionary: DictionariesCreateRequestBody) {
    const { t, ssr_user } = await parent()
    if (!ssr_user) return alert('Please login first') // this should never fire as should be caught in page

    if (dictionary.id.length < MIN_URL_LENGTH) {
      return alert(t('create.choose_different_url'))
    }

    try {
      const pruned_dictionary = pruneObject(dictionary) as DictionariesCreateRequestBody
      if (mode === 'development') {
        console.info(pruned_dictionary)
        if (!confirm('Dictionary value logged to console because in dev mode. Do you still want to create this dictionary?')) {
          return
        }
      }

      const { data, error } = await api_dictionaries_create(pruned_dictionary)
      if (error || !data)
        throw new Error(error?.message || 'Could not create dictionary')

      window.location.replace(`/${data.id}/entries`)
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }
  return {
    MIN_URL_LENGTH,
    dictionary_id_exists,
    create_dictionary,
  }
}) satisfies PageLoad

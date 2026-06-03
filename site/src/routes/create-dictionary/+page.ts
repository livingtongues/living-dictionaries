import type { TablesInsert } from '@living-dictionaries/types'
import { get } from 'svelte/store'
import type { PageLoad } from './$types'
import { pruneObject } from '$lib/helpers/prune'
import { api_create_dictionary } from '$api/db/create-dictionary/_call'
import { mode } from '$lib/supabase'

export const load = (({ parent }) => {
  const MIN_URL_LENGTH = 3

  async function dictionary_id_exists(url: string): Promise<boolean> {
    const { supabase } = await parent()
    const { data: exists } = await supabase.from('dictionaries').select('id').eq('id', url).single()
    return !!exists
  }

  async function create_dictionary(dictionary: TablesInsert<'dictionaries'>) {
    const { t, user, supabase } = await parent()
    const $user = get(user)
    if (!$user) return alert('Please login first') // this should never fire as should be caught in page

    if (dictionary.id.length < MIN_URL_LENGTH) {
      return alert(t('create.choose_different_url'))
    }

    try {
      const pruned_dictionary = pruneObject(dictionary)
      if (mode === 'development') {
        console.info(pruned_dictionary)
        if (!confirm('Dictionary value logged to console because in dev mode. Do you still want to create this dictionary?')) {
          return
        }
      }

      const { error } = await api_create_dictionary({ dictionary: pruned_dictionary })
      if (error)
        throw new Error(error.message)

      const { error: terms_agreement_error } = await supabase.from('user_data').update({
        terms_agreement: new Date().toISOString(),
      }).eq('id', $user.id)
      if (terms_agreement_error) {
        console.error(terms_agreement_error)
      }

      window.location.replace(`/${dictionary.id}/entries`)
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

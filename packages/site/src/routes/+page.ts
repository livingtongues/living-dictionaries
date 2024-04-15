import { error } from '@sveltejs/kit'
import { getCollection } from 'sveltefirets'
import { orderBy, where } from 'firebase/firestore'
import type { IDictionary } from '@living-dictionaries/types'
import type { PageLoad } from './$types'
import { ResponseCodes } from '$lib/constants'

export const load: PageLoad = async () => {
  async function get_private_dictionaries() {
    const dictionaries = await getCollection<IDictionary>('dictionaries', [
      orderBy('name'),
      where('public', '!=', true),
    ])
    return dictionaries
  }

  try {
    const publicDictionaries = await getCollection<IDictionary>('dictionaries', [
      orderBy('name'),
      where('public', '==', true),
    ])
    return { publicDictionaries, get_private_dictionaries }
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err)
  }
}

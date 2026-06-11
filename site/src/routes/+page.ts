import type { DictionaryView } from '$lib/types'
import type { PageLoad } from './$types'
import { api_dictionaries_list } from '$api/dictionaries/_call'

export const load: PageLoad = ({ fetch }) => {
  async function get_dictionaries(visibility: 'public' | 'private') {
    const { data, error } = await api_dictionaries_list(visibility, { fetch })
    if (error) {
      console.error(`Could not load ${visibility} dictionaries: ${error.message}`)
      return [] as DictionaryView[]
    }
    return data.dictionaries
  }

  return {
    get_public_dictionaries: () => get_dictionaries('public'),
    get_private_dictionaries: () => get_dictionaries('private'),
  }
}

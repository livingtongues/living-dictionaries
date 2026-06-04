import type { DictionaryView } from '@living-dictionaries/types'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ fetch }) => {
  async function get_dictionaries(visibility: 'public' | 'private') {
    const response = await fetch(`/api/dictionaries?visibility=${visibility}`)
    if (!response.ok) {
      console.error(`Could not load ${visibility} dictionaries: ${response.status}`)
      return [] as DictionaryView[]
    }
    const { dictionaries } = await response.json() as { dictionaries: DictionaryView[] }
    return dictionaries
  }

  return {
    get_public_dictionaries: () => get_dictionaries('public'),
    get_private_dictionaries: () => get_dictionaries('private'),
  }
}

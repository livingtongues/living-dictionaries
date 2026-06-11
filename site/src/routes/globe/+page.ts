import type { DictionaryView } from '$lib/types'
import type { PageLoad } from './$types'
import { api_dictionaries_list } from '$api/dictionaries/_call'

export const load: PageLoad = async ({ fetch }) => {
  let public_dictionaries: DictionaryView[] = []
  const { data, error } = await api_dictionaries_list('public', { fetch })
  if (error)
    console.error(`Could not load public dictionaries: ${error.message}`)
  else
    public_dictionaries = data.dictionaries

  return {
    public_dictionaries,
    my_dictionaries: [] as DictionaryView[],
    // Default globe center until a real geolocation source is wired up.
    user_latitude: 20,
    user_longitude: 0,
  }
}

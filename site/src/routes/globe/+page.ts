import type { DictionaryView } from '$lib/types'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch }) => {
  let public_dictionaries: DictionaryView[] = []
  const response = await fetch('/api/dictionaries?visibility=public')
  if (response.ok) {
    const { dictionaries } = await response.json() as { dictionaries: DictionaryView[] }
    public_dictionaries = dictionaries
  } else {
    console.error(`Could not load public dictionaries: ${response.status}`)
  }

  return {
    public_dictionaries,
    my_dictionaries: [] as DictionaryView[],
    // Default globe center until a real geolocation source is wired up.
    user_latitude: 20,
    user_longitude: 0,
  }
}

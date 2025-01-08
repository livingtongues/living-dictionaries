import { getCollection } from 'sveltefirets'
import type { Change } from '@living-dictionaries/types'

export async function load({ params, parent }) {
  await parent()
  try {
    const history = await getCollection<Change>(`dictionaries/${params.dictionaryId}/history`)
    return { history }
  } catch (err) {
    console.error(err)
    return { history: null }
  }
}

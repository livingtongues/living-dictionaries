import { error } from '@sveltejs/kit'
import type { IDictionary } from '@living-dictionaries/types'
import { getCollection } from 'sveltefirets'
import { orderBy, where } from 'firebase/firestore'
import type { PageLoad } from './$types'
import { ResponseCodes } from '$lib/constants'

export const load: PageLoad = async ({ parent }) => {
  const { user_from_cookies } = await parent()
  const admin = !!user_from_cookies?.roles?.admin

  let queryConstraints = [orderBy('name'), where('public', '==', true)]
  if (admin)
    queryConstraints = [orderBy('name')]

  try {
    const dictionaries = await getCollection<IDictionary>('dictionaries', queryConstraints)
    return { dictionaries }
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err)
  }
}

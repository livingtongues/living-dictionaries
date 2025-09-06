import { error } from '@sveltejs/kit'
import type { PageLoad } from './$types'
import { ResponseCodes } from '$lib/constants'

export const load: PageLoad = async ({ parent }) => {
  const { admin, supabase } = await parent()

  const query = supabase.from('materialized_dictionaries_view')
    .select()

  try {
    if (admin) {
      const { data: dictionaries_for_list, error: dictionaries_error } = await query
      if (dictionaries_error)
        throw new Error (dictionaries_error.message)
      return { dictionaries_for_list }
    }
    const { data: dictionaries_for_list, error: dictionaries_error } = await query
      .eq('public', true)
    if (dictionaries_error)
      throw new Error (dictionaries_error.message)
    return { dictionaries_for_list }
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err)
  }
}

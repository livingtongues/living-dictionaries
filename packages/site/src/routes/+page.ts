import type { DictionaryView } from '@living-dictionaries/types'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ parent }) => {
  async function get_public_dictionaries() {
    const { supabase } = await parent()
    const { data: public_dictionaries, error } = await supabase.from('materialized_dictionaries_view')
      .select()
      .eq('public', true)
    if (error) {
      console.error(error)
    }
    return public_dictionaries as DictionaryView[]
  }

  async function get_private_dictionaries() {
    const { supabase } = await parent()
    const { data: private_dictionaries, error } = await supabase.from('materialized_dictionaries_view')
      .select()
      .neq('public', true)
      .is('con_language_description', null)

    if (error) {
      console.error(error)
    }
    return private_dictionaries as DictionaryView[]
  }

  return { get_public_dictionaries, get_private_dictionaries }
}

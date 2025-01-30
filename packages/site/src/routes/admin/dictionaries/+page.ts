import type { DictionaryView } from '@living-dictionaries/types'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ parent }) => {
  async function get_public_dictionaries() {
    const { supabase } = await parent()
    const { data: public_dictionaries, error } = await supabase.from('dictionaries_view')
      .select()
      .eq('public', true)
    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return public_dictionaries as DictionaryView[]
  }

  async function get_private_dictionaries() {
    const { supabase } = await parent()
    const { data: private_dictionaries, error } = await supabase.from('dictionaries_view')
      .select()
      .neq('public', true)
      .is('con_language_description', null)

    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return private_dictionaries as DictionaryView[]
  }

  async function get_other_dictionaries() {
    const { supabase } = await parent()
    const { data: private_dictionaries, error } = await supabase.from('dictionaries_view')
      .select()
      .neq('public', true)
      .not('con_language_description', 'is', null)

    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return private_dictionaries as DictionaryView[]
  }

  return { get_public_dictionaries, get_private_dictionaries, get_other_dictionaries }
}

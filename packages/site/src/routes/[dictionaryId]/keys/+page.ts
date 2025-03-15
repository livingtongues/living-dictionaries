import type { PageLoad } from './$types'

export const load = (({ params: { dictionaryId }, parent }) => {
  async function get_keys() {
    const { supabase } = await parent()
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select()
      .eq('dictionary_id', dictionaryId)
    if (error) {
      console.error(error)
      return []
    }
    return keys
  }

  async function generate_key({ can_write }: { can_write: boolean }) {
    const { t, supabase } = await parent()
    try {
      const { error } = await supabase
        .from('api_keys')
        .insert({
          dictionary_id: dictionaryId,
          can_write,
        },
        )
      if (error) {
        console.error(error)
        throw error.message
      }
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  async function delete_key(key_id: string) {
    const { t, supabase } = await parent()
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', key_id)
      if (error) {
        console.error(error)
        throw error.message
      }
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }

  return {
    get_keys,
    generate_key,
    delete_key,
  }
}) satisfies PageLoad

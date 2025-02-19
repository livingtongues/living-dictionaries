export function load({ params, parent }) {
  async function get_content_updates() {
    const { supabase } = await parent()

    const { data: content_updates, error } = await supabase.from('content_updates')
      .select('*')
      .eq('dictionary_id', params.dictionaryId)
      .order('timestamp', { ascending: false })
      .limit(200)

    if (error) {
      console.error(error)
      return []
    }
    return content_updates
  }

  return {
    get_content_updates,
  }
}

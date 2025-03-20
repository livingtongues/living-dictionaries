export function load({ parent }) {
  async function get_content_updates() {
    const { supabase, dictionary } = await parent()
    const { data: content_updates, error } = await supabase.from('content_updates')
      .select('*')
      .eq('dictionary_id', dictionary.id)
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

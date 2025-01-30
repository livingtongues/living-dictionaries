export async function load({ params, parent }) {
  const { supabase } = await parent()
  try {
    const { data: content_updates, error } = await supabase.from('content_updates')
      .select('*')
      .eq('dictionary_id', params.dictionaryId)
      .order('timestamp', { ascending: false })
      .limit(200)

    if (error) {
      console.error(error)
      return { content_updates: null }
    }
    return { content_updates }
  } catch (err) {
    console.error(err)
    return { content_updates: null }
  }
}

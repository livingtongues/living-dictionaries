import { getSupabase } from '.'

export async function get_entry_history(entry_id: string) {
  const supabase = getSupabase()

  const { data: entry_content_updates, error } = await supabase.from('content_updates')
    .select('*')
    .eq('entry_id', entry_id)
    .order('timestamp', { ascending: false })
  return { entry_content_updates, error }
}

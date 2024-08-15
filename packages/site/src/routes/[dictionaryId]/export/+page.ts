import type { PostgrestError } from '@supabase/supabase-js'
import { delay } from 'kitbook'
import type { PageLoad } from './$types'
// import { getSupabase } from '$lib/supabase'
import type { SupaEntry } from '$lib/supabase/database.types'

export const load = (() => {
  async function get_supa_entries(_dictionary_id: string): Promise<{ data?: SupaEntry[], error?: PostgrestError }> {
    const data: SupaEntry[] = await delay([])
    // const supabase = getSupabase()
    // const { data, error } = await supabase
    //   .from('entries_view')
    //   .select()
    //   .eq('dictionary_id', dictionary_id)
    //   .returns<SupaEntry[]>()

    // console.info({ data, error })
    return { data, error: null }
  }

  return { get_supa_entries }
}) satisfies PageLoad

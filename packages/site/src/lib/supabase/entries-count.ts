import { writable } from 'svelte/store'
import type { Supabase } from '.'

export const public_entries_count_store = writable<number>(0)
const public_entries_count_store_error = writable<string>(null)

let _supabase: Supabase | null = null

export function create_public_entries_count_store({ supabase }: { supabase: Supabase }) {
  _supabase = supabase
  reload_public_entries_count()
}

export async function reload_public_entries_count() {
  if (!_supabase) return
  const { data, error } = await _supabase
    .from('public_entries_count')
    .select('count')
    .single()
  if (error) {
    public_entries_count_store_error.set(error.message)
    return
  }
  public_entries_count_store.set(data?.count ?? 0)
}

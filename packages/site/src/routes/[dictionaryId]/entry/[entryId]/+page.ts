import { error, redirect } from '@sveltejs/kit'
import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import { awaitableDocStore } from 'sveltefirets'
import { derived } from 'svelte/store'
import type { PostgrestError } from '@supabase/supabase-js'
import { ResponseCodes } from '$lib/constants'
import { ENTRY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { getSupabase } from '$lib/supabase'
import type { SupaEntry } from '$lib/supabase/database.types.js'
import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry'

export async function load({ params, depends, parent }) {
  depends(ENTRY_UPDATED_LOAD_TRIGGER)
  const entryPath = `dictionaries/${params.dictionaryId}/words/${params.entryId}`

  const entry = await awaitableDocStore<ActualDatabaseEntry>(entryPath)
  const { error: firestore_error, initial_doc } = entry
  if (firestore_error)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, firestore_error)

  if (!initial_doc)
    redirect(ResponseCodes.MOVED_PERMANENTLY, `/${params.dictionaryId}`)

  const { t } = await parent()
  const entry_expanded = derived(entry, $entry => convert_and_expand_entry($entry, t))

  return {
    entry: entry_expanded,
    supa_entry: load_supa_entry(params.entryId),
    shallow: false,
  }
}

async function load_supa_entry(entry_id: string): Promise<{ data?: SupaEntry, error?: PostgrestError }> {
  const supabase = getSupabase()
  const { data, error: supaError } = await supabase
    .from('entries_view')
    .select()
    .eq('id', entry_id)
    .returns<SupaEntry[]>()

  const supaEntry = data?.[0]
  console.info({ supaEntry, supaError })
  return { data: supaEntry, error: supaError }
}

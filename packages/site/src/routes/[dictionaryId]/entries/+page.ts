// packages/site/src/routes/[dictionaryId]/entries/+page.ts
import { createQueryParamStore } from 'svelte-pieces'
import { writable } from 'svelte/store'
import type { Tables } from '@living-dictionaries/types'
import type { QueryParams } from '$lib/search/types'

export async function load({ parent }) {
  // 1. Mantener TU implementación exacta de search_params
  const default_params: QueryParams = {
    page: 1,
    query: '',
  }
  const search_params = createQueryParamStore({
    key: 'q',
    startWith: default_params,
    cleanFalseValues: true,
  })

  // 2. Implementación del store de audio SIN TOCAR search_params
  const { supabase, dictionary } = await parent()
  const audio_store = writable<Tables<'audio'>[]>([])

  try {
    const { data, error } = await supabase
      .from('audio')
      .select('*')
      .eq('dictionary_id', dictionary.id)
      .order('created_at', { ascending: false })

    if (!error) audio_store.set(data || [])
  } catch (e) {
    console.error('Error audio:', e)
  }

  // 3. Retornar ambos SIN MODIFICAR search_params
  return {
    search_params, // ← Exactamente como lo tienes
    audio_store, // ← Nuevo store
  }
}

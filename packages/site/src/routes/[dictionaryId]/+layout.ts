import { error, redirect } from '@sveltejs/kit'
import type { Citation, IAbout, Partner } from '@living-dictionaries/types'
import { docExists, firebaseConfig, getCollection, getDocument } from 'sveltefirets'
import { type Readable, derived, get } from 'svelte/store'
import type { LayoutLoad } from './$types'
import { MINIMUM_ABOUT_LENGTH, ResponseCodes } from '$lib/constants'
import { browser } from '$app/environment'
import { DICTIONARY_UPDATED_LOAD_TRIGGER, dbOperations } from '$lib/dbOperations'
import { create_index, load_cached_index, search_entries, update_index_entry } from '$lib/search'
import { cached_data_store } from '$lib/supabase/cached-data'
import { url_from_storage_path } from '$lib/helpers/media'

export const load: LayoutLoad = async ({ params: { dictionaryId: dictionary_id }, parent, depends }) => {
  depends(DICTIONARY_UPDATED_LOAD_TRIGGER)

  try {
    const { supabase, user } = await parent()
    const { data: dictionary, error: dictionary_error } = await supabase.from('dictionaries').select().eq('id', dictionary_id).single()

    if (dictionary_error)
      redirect(ResponseCodes.MOVED_PERMANENTLY, '/')

    if (browser)
      load_cached_index(dictionary_id)

    const is_manager: Readable<boolean> = derived(user, ($user, set) => {
      if (!$user) return set(false)
      if ($user.roles?.admin > 0) return set(true)
      if (!browser) return set(false)

      docExists(`dictionaries/${dictionary_id}/managers/${$user.uid}`)
        .then(exists => set(exists))
        .catch((err) => {
          console.error('Manager checking error: ', err)
        })
    })

    const is_contributor: Readable<boolean> = derived(user, ($user, set) => {
      if (!$user) return set(false)
      if (!browser) return set(false)
      docExists(`dictionaries/${dictionary_id}/contributors/${$user.uid}`)
        .then(exists => set(exists))
        .catch((err) => {
          console.error('Contributor checking error: ', err)
        })
    })

    const can_edit: Readable<boolean> = derived([is_manager, is_contributor], ([$is_manager, $is_contributor]) => $is_manager || $is_contributor)

    const default_entries_per_page = 20

    const entries = cached_data_store({ materialized_view: 'materialized_entries_view', table: 'entries_view', dictionary_id, supabase, log: true })
    const speakers = cached_data_store({ table: 'speakers_view', dictionary_id, supabase })
    const tags = cached_data_store({ table: 'tags', dictionary_id, supabase })
    const dialects = cached_data_store({ table: 'dialects', dictionary_id, supabase })
    const photos = cached_data_store({ table: 'photos', dictionary_id, supabase })
    const videos = cached_data_store({ table: 'videos_view', dictionary_id, supabase })
    const sentences = cached_data_store({ table: 'sentences', dictionary_id, supabase })

    // maybe need to make data null and then just subscribe to data and when it is an array (empty or with items) then create_index so that if the entries are refreshed or updated the index can be updated
    const unsub = entries.loading.subscribe(async (loading) => {
      if (!loading) {
        await create_index(get(entries), dictionary_id)
        entries.search_index_updated.set(true)
        unsub()
      }
    })

    entries.updated_item.subscribe(entry => entry && update_index_entry(entry, dictionary_id))

    async function reset_caches() {
      await Promise.all([
        entries.reset(),
        speakers.reset(),
        dialects.reset(),
        photos.reset(),
        videos.reset(),
        sentences.reset(),
      ])
    }

    async function about_is_too_short() {
      const about_content = await getDocument<IAbout>(`dictionaries/${dictionary_id}/info/about`)
      const about_length = about_content.about?.length || 0
      return about_length < MINIMUM_ABOUT_LENGTH
    }

    return {
      dictionary,
      dbOperations,
      url_from_storage_path: (path: string) => url_from_storage_path(path, firebaseConfig.storageBucket),
      entries,
      speakers,
      tags,
      dialects,
      photos,
      videos,
      sentences,
      reset_caches,
      default_entries_per_page,
      search_entries,
      is_manager,
      is_contributor,
      can_edit,
      about_is_too_short,
      load_partners: async () => await getCollection<Partner>(`dictionaries/${dictionary_id}/partners`),
      load_citation: async () => await getDocument<Citation>(`dictionaries/${dictionary_id}/info/citation`),
    }
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err)
  }
}

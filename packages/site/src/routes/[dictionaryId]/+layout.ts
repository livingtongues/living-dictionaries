import { error, redirect } from '@sveltejs/kit'
import type { Citation, IAbout, IDictionary, Partner } from '@living-dictionaries/types'
import { awaitableDocStore, docExists, firebaseConfig, getCollection, getDocument } from 'sveltefirets'
import { type Readable, derived, get } from 'svelte/store'
import type { LayoutLoad } from './$types'
import { ResponseCodes } from '$lib/constants'
import { browser } from '$app/environment'
import { dbOperations } from '$lib/dbOperations'
import { create_index, load_cached_index, search_entries, update_index_entry } from '$lib/search'
import { cached_data_store } from '$lib/supabase/cached-data'
import { getSupabase } from '$lib/supabase'
import { url_from_storage_path } from '$lib/helpers/media'

export const load: LayoutLoad = async ({ params: { dictionaryId }, parent }) => {
  try {
    const dictionary = await awaitableDocStore<IDictionary>(`dictionaries/${dictionaryId}`)
    const { error: firestore_error, initial_doc: initial_dictionary } = dictionary
    if (firestore_error)
      error(ResponseCodes.INTERNAL_SERVER_ERROR, firestore_error)

    if (!initial_dictionary)
      redirect(ResponseCodes.MOVED_PERMANENTLY, '/')

    const dictionary_id = initial_dictionary.id
    load_cached_index(dictionary_id)

    const { user } = await parent()

    const is_manager: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if (!$user) return set(false)
        if ($user.roles?.admin > 0) return set(true)
        if (!browser) return set(false)

        docExists(`dictionaries/${$dictionary.id}/managers/${$user.uid}`)
          .then(exists => set(exists))
          .catch((err) => {
            console.error('Manager checking error: ', err)
          })
      },
    )

    const is_contributor: Readable<boolean> = derived(
      [user, dictionary],
      ([$user, $dictionary], set) => {
        if (!$user) return set(false)
        if (!browser) return set(false)
        docExists(`dictionaries/${$dictionary.id}/contributors/${$user.uid}`)
          .then(exists => set(exists))
          .catch((err) => {
            console.error('Contributor checking error: ', err)
          })
      },
    )

    const can_edit: Readable<boolean> = derived([is_manager, is_contributor], ([$is_manager, $is_contributor]) => $is_manager || $is_contributor)

    const default_entries_per_page = 20

    const supabase = getSupabase()
    const entries = cached_data_store({ materialized_view: 'materialized_entries_view', table: 'entries_view', dictionary_id, supabase, log: true })
    const speakers = cached_data_store({ table: 'speakers_view', dictionary_id, supabase })
    const dialects = cached_data_store({ table: 'dialects', dictionary_id, supabase })
    const photos = cached_data_store({ table: 'photos', dictionary_id, supabase })
    const videos = cached_data_store({ table: 'videos_view', dictionary_id, supabase })
    const sentences = cached_data_store({ table: 'sentences', dictionary_id, supabase })

    // maybe need to make data null and then just subscribe to data and when it is an array (empty or with items) then create_index so that if the entries are refreshed or updated the index can be updated
    const unsub = entries.loading.subscribe((loading) => {
      if (!loading) {
        create_index(get(entries))
        unsub()
      }
    })

    entries.updated_item.subscribe(entry => entry && update_index_entry(entry))

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

    // TODO: make non-blocking
    const about_content = await awaitableDocStore<IAbout>(`dictionaries/${dictionaryId}/info/about`)

    return {
      supabase,
      dictionary,
      dbOperations,
      url_from_storage_path: (path: string) => url_from_storage_path(path, firebaseConfig.storageBucket),
      entries,
      speakers,
      dialects,
      photos,
      videos,
      sentences,
      reset_caches,
      about_content,
      default_entries_per_page,
      search_entries,
      is_manager,
      is_contributor,
      can_edit,
      load_partners: async () => await getCollection<Partner>(`dictionaries/${dictionaryId}/partners`),
      load_citation: async () => await getDocument<Citation>(`dictionaries/${dictionaryId}/info/citation`),
    }
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err)
  }
}

import { error, redirect } from '@sveltejs/kit'
import type { Tables, TablesUpdate } from '@living-dictionaries/types'
import { type Readable, derived, get } from 'svelte/store'
import { readable } from 'svelte/store'
import type { LayoutLoad } from './$types'
import { MINIMUM_ABOUT_LENGTH, ResponseCodes } from '$lib/constants'
import { browser } from '$app/environment'
import { DICTIONARY_UPDATED_LOAD_TRIGGER, dbOperations } from '$lib/dbOperations'
import { create_index, load_cached_index, search_entries, update_index_entry } from '$lib/search'
import { cached_data_store } from '$lib/supabase/cached-data'
import { url_from_storage_path } from '$lib/helpers/media'
import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
import { invalidate } from '$app/navigation'

export const load: LayoutLoad = async ({ params: { dictionaryId: dictionary_id }, parent, depends }) => {
  depends(DICTIONARY_UPDATED_LOAD_TRIGGER)

  try {
    const { supabase, admin, my_dictionaries } = await parent()
    const { data: dictionary, error: dictionary_error } = await supabase.from('dictionaries').select().eq('id', dictionary_id).single()

    if (dictionary_error)
      redirect(ResponseCodes.MOVED_PERMANENTLY, '/')

    if (browser)
      load_cached_index(dictionary_id)

    const is_manager: Readable<boolean> = derived([admin, my_dictionaries], ([$admin, $my_dictionaries], set) => {
      if ($admin > 0) return set(true)
      if ($my_dictionaries.find(({ id, role }) => id === dictionary_id && role === 'manager')) return set(true)
    }, false)

    const is_contributor: Readable<boolean> = derived([admin, my_dictionaries], ([$admin, $my_dictionaries], set) => {
      if ($admin > 0) return set(true)
      if ($my_dictionaries.find(({ id, role }) => id === dictionary_id && role === 'contributor')) return set(true)
    }, false)

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

    const dictionary_info = readable<Tables<'dictionary_info'>>({} as Tables<'dictionary_info'>, (set) => {
      (async () => {
        const { data } = await supabase.from('dictionary_info').select().eq('dictionary_id', dictionary_id).single()
        if (data) set(data)
      })()
    })

    function about_is_too_short() {
      const { about } = get(dictionary_info)
      const about_length = about?.length || 0
      return about_length < MINIMUM_ABOUT_LENGTH
    }

    const dictionary_editors = readable<Tables<'dictionary_roles_with_profiles'>[]>([], (set) => {
      (async () => {
        const { data: editors, error } = await supabase.from('dictionary_roles_with_profiles')
          .select()
          .eq('dictionary_id', dictionary_id)
        if (error) {
          console.error(error)
          return []
        }
        if (editors.length) set(editors)
      })()
    })

    async function load_partners() {
      const { data } = await supabase.from('dictionary_partners')
        .select(`
        id,
        name,
        photo:photos(
          id,
          storage_path,
          serving_url
        )
      `)
        .eq('dictionary_id', dictionary_id)
      return data
    }

    async function update_dictionary(change: TablesUpdate<'dictionaries'>) {
      const { error } = await supabase.from('dictionaries').update(change)
        .eq('id', dictionary.id)
      if (error) throw new Error(error.message)
      await invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)
    }

    return {
      dictionary,
      dbOperations,
      url_from_storage_path: (path: string) => url_from_storage_path(path, PUBLIC_STORAGE_BUCKET),
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
      dictionary_info,
      about_is_too_short,
      dictionary_editors,
      load_partners,
      update_dictionary,
    }
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err)
  }
}

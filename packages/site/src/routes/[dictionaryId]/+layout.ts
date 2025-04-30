import { error, redirect } from '@sveltejs/kit'
import type { Tables, TablesUpdate } from '@living-dictionaries/types'
import { type Readable, derived, get, writable } from 'svelte/store'
import { readable } from 'svelte/store'
import type { LayoutLoad } from './$types'
import { MINIMUM_ABOUT_LENGTH, ResponseCodes } from '$lib/constants'
import { DICTIONARY_UPDATED_LOAD_TRIGGER, dbOperations } from '$lib/dbOperations'
import { create_index, search_entries } from '$lib/search'
import { url_from_storage_path } from '$lib/helpers/media'
import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
import { invalidate } from '$app/navigation'
import { create_entries_data_store } from '$lib/supabase/entries-data-store'

export const load: LayoutLoad = async ({ params: { dictionaryId: dictionary_url }, parent, depends }) => {
  depends(DICTIONARY_UPDATED_LOAD_TRIGGER)

  try {
    const { supabase, admin, my_dictionaries } = await parent()

    let dictionary: Tables<'dictionaries'>
    const { data: url_dictionary, error: url_dictionary_error } = await supabase.from('dictionaries').select().eq('url', dictionary_url).single()
    if (url_dictionary_error) {
      const { data: id_dictionary, error: dictionary_id_error } = await supabase.from('dictionaries').select().eq('id', dictionary_url).single()
      if (dictionary_id_error) {
        redirect(ResponseCodes.MOVED_PERMANENTLY, '/')
      }
      dictionary = id_dictionary
    } else {
      dictionary = url_dictionary
    }

    const dictionary_id = dictionary.id

    // if (browser)
    // TODO: bring cache back in
    //   load_cached_index(dictionary_id)

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

    // TODO later: bring in sentence_videos, sentence_photos, texts
    const entries_data = create_entries_data_store({ dictionary_id, supabase, log: true })
    const search_index_updated = writable(false)

    const unsub = entries_data.loading.subscribe(async (loading) => {
      if (!loading) {
        await create_index(get(entries_data), dictionary_id)
        search_index_updated.set(true)
        unsub()
        search_index_updated.set(false)
      }
    })

    // TODO: figure out how to update just the index of the changed entry
    // entries_data.updated_item.subscribe(entry => entry && update_index_entry(entry, dictionary_id))

    const dictionary_info = readable<Tables<'dictionary_info'>>({} as Tables<'dictionary_info'>, (set) => {
      (async () => {
        const { data } = await supabase.from('dictionary_info').select().eq('id', dictionary_id).single()
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
      entries_data,
      speakers: entries_data.speakers,
      tags: entries_data.tags,
      dialects: entries_data.dialects,
      photos: entries_data.photos,
      videos: entries_data.videos,
      sentences: entries_data.sentences,
      reset_caches: entries_data.reset_caches,
      default_entries_per_page,
      search_entries,
      is_manager,
      search_index_updated,
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

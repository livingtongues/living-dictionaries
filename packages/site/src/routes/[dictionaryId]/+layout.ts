import { error, redirect } from '@sveltejs/kit'
import type { Tables, TablesUpdate } from '@living-dictionaries/types'
import { type Readable, derived, get } from 'svelte/store'
import { readable } from 'svelte/store'
import type { LayoutLoad } from './$types'
import { MINIMUM_ABOUT_LENGTH, ResponseCodes } from '$lib/constants'
import { DICTIONARY_UPDATED_LOAD_TRIGGER, dbOperations } from '$lib/dbOperations'
import { url_from_storage_path } from '$lib/helpers/media'
import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
import { invalidate } from '$app/navigation'
import { create_entries_ui_store } from '$lib/search/entries-ui-store'

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

    const is_manager: Readable<boolean> = derived([admin, my_dictionaries], ([$admin, $my_dictionaries], set) => {
      if ($admin > 0) return set(true)
      if ($my_dictionaries.find(({ id, role }) => id === dictionary_id && role === 'manager')) return set(true)
    }, false)

    const is_contributor: Readable<boolean> = derived([admin, my_dictionaries], ([$admin, $my_dictionaries], set) => {
      if ($admin > 0) return set(true)
      if ($my_dictionaries.find(({ id, role }) => id === dictionary_id && role === 'contributor')) return set(true)
    }, false)

    const can_edit = derived([is_manager, is_contributor], ([$is_manager, $is_contributor]) => $is_manager || $is_contributor)

    const default_entries_per_page = 20

    const entries_ui = create_entries_ui_store({ dictionary_id, can_edit })

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
      dictionary_info,
      is_manager,
      is_contributor,
      can_edit,
      dictionary_editors,
      load_partners,
      about_is_too_short,
      update_dictionary,
      url_from_storage_path: (path: string) => url_from_storage_path(path, PUBLIC_STORAGE_BUCKET),
      default_entries_per_page,
      dbOperations,

      entries_data: entries_ui,
      speakers: entries_ui.speakers,
      tags: entries_ui.tags,
      dialects: entries_ui.dialects,
      reset_caches: entries_ui.reset_caches,
      search_entries: entries_ui.search_entries,
      search_index_updated: entries_ui.search_index_updated,
    }
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err)
  }
}

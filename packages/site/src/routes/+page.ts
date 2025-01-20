import { getDb } from 'sveltefirets'
import type { DictionaryView } from '@living-dictionaries/types'
import { collectionGroup, getDocs, query, where } from 'firebase/firestore'
import { readable } from 'svelte/store'
import type { PageLoad } from './$types'
import { browser } from '$app/environment'

export const load: PageLoad = ({ parent }) => {
  async function get_public_dictionaries() {
    const { supabase } = await parent()
    const { data: public_dictionaries, error } = await supabase.from('materialized_dictionaries_view')
      .select()
      .eq('public', true)
    if (error) {
      console.error(error)
    }
    return public_dictionaries as DictionaryView[]
  }

  async function get_private_dictionaries() {
    const { supabase } = await parent()
    const { data: private_dictionaries, error } = await supabase.from('materialized_dictionaries_view')
      .select()
      .neq('public', true)
    if (error) {
      console.error(error)
    }
    return private_dictionaries as DictionaryView[]
  }

  function get_my_dictionaries(user_id: string) {
    if (!browser || !user_id) {
      return readable<DictionaryView[]>([])
    }
    const key = `my_dictionaries--${user_id}`
    const start_with = JSON.parse(localStorage[key] || '[]') as DictionaryView[]
    const my_dictionaries = readable<DictionaryView[]>(start_with, (set) => {
      const dictionary_ids_with_role = []
      const db = getDb();

      (async () => {
        const managers = query(collectionGroup(db, 'managers'), where('id', '==', user_id))
        const managersSnapshot = await getDocs(managers)
        managersSnapshot.forEach((doc) => {
          const { id } = doc.ref.path.match(/dictionaries\/(?<id>.*?)\//).groups
          dictionary_ids_with_role.push({ id, dictRole: 'manager' })
        })

        const contributors = query(collectionGroup(db, 'contributors'), where('id', '==', user_id))
        const contributorsSnapshot = await getDocs(contributors)
        contributorsSnapshot.forEach((doc) => {
          const { id } = doc.ref.path.match(/dictionaries\/(?<id>.*?)\//).groups
          dictionary_ids_with_role.push({ id, dictRole: 'contributor' })
        })

        const { supabase } = await parent()
        const dictionaries = await Promise.all(dictionary_ids_with_role.map(async ({ id }) => {
          const { data: dictionary, error } = await supabase.from('dictionaries_view').select().eq('id', id).single()
          if (error) {
            console.error(`Could not fetch my-dictionary: ${id}`)
            return null
          }
          return dictionary
          // TODO: merge in dictRole from myDictionaryIds to myDictionaries
        }))
        const updated_dictionaries = dictionaries.filter(Boolean) as DictionaryView[]
        set(updated_dictionaries)
        localStorage.setItem(key, JSON.stringify(updated_dictionaries))
      })()
    })

    return my_dictionaries
  }

  return { get_public_dictionaries, get_private_dictionaries, get_my_dictionaries }
}

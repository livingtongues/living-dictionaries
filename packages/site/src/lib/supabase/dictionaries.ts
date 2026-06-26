import { readable } from 'svelte/store'
import type { DictionaryView } from '@living-dictionaries/types'
import type { Supabase } from '.'
import { browser } from '$app/environment'

export interface DictionaryWithRoles extends DictionaryView {
  role: 'manager' | 'contributor'
}

export function create_my_dictionaries_store({ user_id, supabase }: { user_id: string, supabase: Supabase }) {
  if (!browser || !user_id) {
    return readable<DictionaryWithRoles[]>([])
  }
  const key = `my_dictionaries--${user_id}`
  const start_with = JSON.parse(localStorage[key] || '[]') as DictionaryWithRoles[]
  const my_dictionaries = readable<DictionaryWithRoles[]>(start_with, (set) => {
    (async () => {
      const { data: dictionary_roles, error: my_dictionaries_error } = await supabase.from('dictionary_roles').select().eq('user_id', user_id)
      if (my_dictionaries_error) {
        console.error(my_dictionaries_error)
        return null
      }

      const dictionaries = await Promise.all(dictionary_roles.map(async ({ dictionary_id, role }) => {
        const { data: dictionary, error } = await supabase.from('dictionaries_view').select().eq('id', dictionary_id).single()
        if (error) {
          console.error(`Could not fetch my-dictionary: ${dictionary_id}`)
          return null
        }
        return { ...dictionary, role }
      }))
      const updated_dictionaries = dictionaries.filter(Boolean) as DictionaryWithRoles[]
      set(updated_dictionaries)
      localStorage.setItem(key, JSON.stringify(updated_dictionaries))
    })()
  })

  return my_dictionaries
}

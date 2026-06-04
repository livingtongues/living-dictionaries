import { readable } from 'svelte/store'
import type { DictionaryView } from '@living-dictionaries/types'
import { browser } from '$app/environment'

export interface DictionaryWithRoles extends DictionaryView {
  role: string
}

// Global catalog store consumed via `$page.data.dictionaries` (Footer + /dictionaries list).
// M4: backed by the server SQLite catalog endpoint (`/api/dictionaries` → shared.db).
export function create_dictionaries_store() {
  if (!browser)
    return readable<DictionaryView[]>([])
  return readable<DictionaryView[]>([], (set) => {
    (async () => {
      const response = await fetch('/api/dictionaries?visibility=public')
      if (!response.ok) {
        console.error(`Could not load dictionaries: ${response.status}`)
        return
      }
      const { dictionaries } = await response.json() as { dictionaries: DictionaryView[] }
      set(dictionaries || [])
    })()
  })
}

// M4-auth: the signed-in user's dictionaries (roles joined to the SQLite
// catalog) for the homepage "My Dictionaries" overlay. Backed by
// `/api/me/dictionaries` (server-side `dictionary_roles` ⋈ `dictionaries`).
export function create_my_dictionaries_store({ user_id }: { user_id: string | undefined }) {
  if (!browser || !user_id) {
    return readable<DictionaryWithRoles[]>([])
  }
  const key = `my_dictionaries--${user_id}`
  const start_with = JSON.parse(localStorage[key] || '[]') as DictionaryWithRoles[]
  return readable<DictionaryWithRoles[]>(start_with, (set) => {
    (async () => {
      const response = await fetch('/api/me/dictionaries')
      if (!response.ok) {
        console.error(`Could not load my dictionaries: ${response.status}`)
        return
      }
      const { dictionaries } = await response.json() as { dictionaries: DictionaryWithRoles[] }
      set(dictionaries || [])
      localStorage.setItem(key, JSON.stringify(dictionaries || []))
    })()
  })
}

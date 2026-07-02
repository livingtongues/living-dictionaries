import { readable } from 'svelte/store'
import type { DictionaryView } from '$lib/types'
import { browser } from '$app/environment'
import { api_dictionaries_list } from '$api/dictionaries/_call'

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
      const { data, error } = await api_dictionaries_list('public')
      if (error) {
        console.error(`Could not load dictionaries: ${error.message}`)
        return
      }
      set(data.dictionaries || [])
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
        // A 401 here is EXPECTED, not a fault: the client thinks it's signed in
        // (there's a `user_id`) but the `session` cookie has since expired
        // server-side. Don't ship it as an `error` row (console.error is patched
        // by remote-log) — it's a benign auth gate. Other statuses are real.
        if (response.status !== 401)
          console.error(`Could not load my dictionaries: ${response.status}`)
        return
      }
      const { dictionaries } = await response.json() as { dictionaries: DictionaryWithRoles[] }
      set(dictionaries || [])
      localStorage.setItem(key, JSON.stringify(dictionaries || []))
    })()
  })
}

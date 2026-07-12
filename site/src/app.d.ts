// https://kit.svelte.dev/docs/types#app
/// <reference types="unplugin-icons/types/svelte" />
import type { Readable } from 'svelte/store'
import type { LayoutData as DictionaryLayoutData } from './routes/[dictionaryId]/$types'
import type { AuthUser } from '$lib/auth/user.svelte'
import type { AuthUserData } from '$lib/auth/types'
import type { MyDictionaryRolesCache } from '$lib/me/dictionary-roles.svelte'
import type { DictionaryWithRoles } from '$lib/dictionaries'

declare global {
  namespace App {
    interface PageData {
      locale: import('$lib/i18n/locales').LocaleCode
      t: import('$lib/i18n/types.ts').TranslateFunction
      auth_user: AuthUser
      dict_roles: MyDictionaryRolesCache
      ssr_user: AuthUserData | null
      my_dictionaries: Readable<DictionaryWithRoles[]>

      // From dictionary layout so all optional
      can_edit?: boolean
      is_manager?: boolean
      is_contributor?: boolean
      dictionary?: DictionaryLayoutData['dictionary']
      writes?: DictionaryLayoutData['writes']
      url_from_storage_path?: DictionaryLayoutData['url_from_storage_path']
      entries_data?: DictionaryLayoutData['entries_data']
      speakers?: DictionaryLayoutData['speakers']
      tags?: DictionaryLayoutData['tags']
      dialects?: DictionaryLayoutData['dialects']
      photos?: DictionaryLayoutData['photos']
      videos?: DictionaryLayoutData['videos']
      sentences?: DictionaryLayoutData['sentences']
      update_dictionary?: DictionaryLayoutData['update_dictionary']
    }
    interface PageState {
      entry_id?: string
      // Set by the dictionary home's search pill so the entries page focuses its search input on arrival.
      focus_search?: boolean
      // Smart back-target persisted into history.state by admin detail pages (use_admin_back).
      admin_back?: { label: string, url: string }
    }
    // interface Error {}
    // interface Platform {}
  }

  interface ViewTransition {
    updateCallbackDone: Promise<void>
    ready: Promise<void>
    finished: Promise<void>
    skipTransition: () => void
  }

  interface Document {
    startViewTransition: (updateCallback: () => Promise<void>) => ViewTransition
  }
}

export {}

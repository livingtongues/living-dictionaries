// https://kit.svelte.dev/docs/types#app
/// <reference types="unplugin-icons/types/svelte" />
import type { Readable } from 'svelte/store'
import type { LayoutData as DictionaryLayoutData } from './routes/[dictionaryId]/$types'
import type { AuthUser } from '$lib/auth/user.svelte'
import type { AuthUserData } from '$lib/auth/types'
import type { MyDictionaryRolesCache } from '$lib/me/dictionary-roles.svelte'
import type { DictionaryWithRoles } from '$lib/supabase/dictionaries'
import type { Supabase } from '$lib/supabase'

declare global {
  namespace App {
    interface Locals {
      getSession: () => Promise<{ data: { user: any, session: any }, error: any, supabase: Supabase }>
    }
    interface PageData {
      locale: import('$lib/i18n/locales').LocaleCode
      t: import('$lib/i18n/types.ts').TranslateFunction
      supabase: Supabase
      auth_user: AuthUser
      dict_roles: MyDictionaryRolesCache
      ssr_user: AuthUserData | null
      admin: number
      my_dictionaries: Readable<DictionaryWithRoles[]>

      // From dictionary layout so all optional
      can_edit?: boolean
      is_manager?: boolean
      is_contributor?: boolean
      dictionary?: DictionaryLayoutData['dictionary']
      dbOperations?: DictionaryLayoutData['dbOperations']
      url_from_storage_path?: DictionaryLayoutData['url_from_storage_path']
      entries_data?: DictionaryLayoutData['entries_data']
      speakers?: DictionaryLayoutData['speakers']
      tags?: DictionaryLayoutData['tags']
      dialects?: DictionaryLayoutData['dialects']
      photos?: DictionaryLayoutData['photos']
      videos?: DictionaryLayoutData['videos']
      sentences?: DictionaryLayoutData['sentences']
      dictionary_info?: DictionaryLayoutData['dictionary_info']
      dictionary_editors?: DictionaryLayoutData['dictionary_editors']
      load_partners?: DictionaryLayoutData['load_partners']
      update_dictionary?: DictionaryLayoutData['update_dictionary']
    }
    interface PageState {
      entry_id?: string
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

// https://kit.svelte.dev/docs/types#app
import type { AuthResponse } from '@supabase/supabase-js'
import type { Readable } from 'svelte/store'
import type { LayoutData as DictionaryLayoutData } from './routes/[dictionaryId]/$types'
import type { BaseUser } from '$lib/supabase/user'
import type { DictionaryWithRoles } from '$lib/supabase/dictionaries'
import type { Supabase } from '$lib/supabase'

declare global {
  namespace App {
    interface Locals {
      getSession: () => Promise<AuthResponse & { supabase: Supabase }> | null
    }
    interface PageData {
      locale: import('$lib/i18n/locales').LocaleCode
      t: import('$lib/i18n/types.ts').TranslateFunction
      admin: Readable<number>
      supabase: Supabase
      authResponse: AuthResponse
      user: Readable<BaseUser>
      my_dictionaries: Readable<DictionaryWithRoles[]>

      // From dictionary layout so all optional
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
    // eslint-disable-next-line ts/method-signature-style
    startViewTransition(updateCallback: () => Promise<void>): ViewTransition
  }

  interface Window {
    handleSignInWithGoogle: (response) => Promise<void>
  }
}

export {}

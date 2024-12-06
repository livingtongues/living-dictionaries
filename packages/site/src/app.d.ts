// https://kit.svelte.dev/docs/types#app
// import type { BaseUser } from '$lib/supabase/user'
// import type { AuthResponse } from '@supabase/supabase-js'
import type { Readable } from 'svelte/store'
import type { LayoutData as DictionaryLayoutData } from './routes/[dictionaryId]/$types'
import type { Supabase } from '$lib/supabase/database.types'

declare global {
  namespace App {
    // interface Locals {
    // getSession(): Promise<AuthResponse & { supabase: Supabase}> | null
    // }
    interface PageData {
      locale: import('$lib/i18n/locales').LocaleCode
      t: import('$lib/i18n/types.ts').TranslateFunction
      user: Readable<import('@living-dictionaries/types').IUser>
      admin: Readable<number>
      // authResponse: AuthResponse

      // From dictionary layout so all optional
      supabase?: Supabase
      dictionary?: DictionaryLayoutData['dictionary']
      dbOperations?: DictionaryLayoutData['dbOperations']
      url_from_storage_path?: DictionaryLayoutData['url_from_storage_path']
      entries?: DictionaryLayoutData['entries']
      speakers?: DictionaryLayoutData['speakers']
      tags?: DictionaryLayoutData['tags']
      dialects?: DictionaryLayoutData['dialects']
      photos?: DictionaryLayoutData['photos']
      videos?: DictionaryLayoutData['videos']
      sentences?: DictionaryLayoutData['sentences']
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
}

export {}

// https://kit.svelte.dev/docs/types#app
// import type { BaseUser } from '$lib/supabase/user'
// import type { AuthResponse } from '@supabase/supabase-js'
import type { Readable } from 'svelte/store'
import type { collectionStore } from 'sveltefirets'
import type { ISpeaker } from '@living-dictionaries/types'
import type { DbOperations } from '$lib/dbOperations'

// import type { Supabase } from '$lib/supabase/database.types'

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
      // supabase: Supabase
      // authResponse: AuthResponse

      // From dictionary layout so all optional
      dbOperations?: DbOperations
      speakers?: Awaited<ReturnType<typeof collectionStore<ISpeaker>>>
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

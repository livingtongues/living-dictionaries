// https://kit.svelte.dev/docs/types#app
// import type { BaseUser } from '$lib/supabase/user'
// import type { AuthResponse } from '@supabase/supabase-js'
import type { Readable } from 'svelte/store'
// import type { Supabase } from '$lib/supabase/database.types'

declare global {
	namespace App {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Locals {
			// getSession(): Promise<AuthResponse & { supabase: Supabase}> | null
    }
    interface PageData {
      locale: import('$lib/i18n/locales').LocaleCode;
      t: import('$lib/i18n/types.ts').TranslateFunction;
			user: Readable<import('@living-dictionaries/types').IUser>
			admin: Readable<number>
			// supabase: Supabase
			// authResponse: AuthResponse
    }
		// interface Error {}
		// interface Platform {}
	}

	interface ViewTransition {
		updateCallbackDone: Promise<void>;
		ready: Promise<void>;
		finished: Promise<void>;
		skipTransition: () => void;
	}

	interface Document {
		startViewTransition(updateCallback: () => Promise<void>): ViewTransition;
	}
}

export {}

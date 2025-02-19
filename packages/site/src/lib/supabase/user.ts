import type { AuthResponse, Session, User } from '@supabase/supabase-js'
import { writable } from 'svelte/store'
import type { GoogleAuthUserMetaData } from '@living-dictionaries/types'
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME, USER_LOCAL_STORAGE_KEY } from '../constants'
import type { Supabase } from '.'
import { set_cookie } from '$lib/helpers/cookies'

const browser = typeof window !== 'undefined'

export type BaseUser = User & {
  app_metadata: {
    provider?: string
    providers?: string[]
    admin?: number
  }
  user_metadata: GoogleAuthUserMetaData
}

/** Subscribes to current user, caches it to local storage, and sets cookie for server-side rendering. */
export function createUserStore({ supabase, authResponse, log = false }: { supabase: Supabase, authResponse: AuthResponse, log?: boolean }) {
  const { subscribe, set } = writable<BaseUser>(authResponse?.data.user)
  if (browser) {
    let cached_user_stringified = null

    if (authResponse?.data?.user) {
      cached_user_stringified = localStorage.getItem(USER_LOCAL_STORAGE_KEY)
      if (cached_user_stringified)
        set(JSON.parse(cached_user_stringified))
    }

    let current_session_expires_at = authResponse?.data?.session?.expires_at

    supabase.auth.onAuthStateChange((event, session) => {
      if (log)
        console.info({ authStateChangeEvent: event })
      const new_session_expires_at = session?.expires_at
      const same_session = current_session_expires_at === new_session_expires_at
      if (log)
        console.info({ same_session, current_session_expires_at, new_session_expires_at })

      if (session) {
        if (same_session) {
          const new_user_stringified = JSON.stringify(session.user)
          if (new_user_stringified !== cached_user_stringified) {
            set(session.user)
            cache_user(session)
          }
        } else {
          set(session.user)
          cache_user(session)
        }
      } else {
        set(null)
        if (log)
          console.info('set user to null')
        remove_cached_user()
      }

      current_session_expires_at = session?.expires_at
    })
  }

  return {
    subscribe,
  }
}

function cache_user(session: Session) {
  localStorage.setItem(USER_LOCAL_STORAGE_KEY, JSON.stringify(session.user))

  const century = 100 * 365 * 24 * 60 * 60
  set_cookie(ACCESS_TOKEN_COOKIE_NAME, session.access_token, { maxAge: century, path: '/', sameSite: 'lax' })
  set_cookie(REFRESH_TOKEN_COOKIE_NAME, session.refresh_token, { maxAge: century, path: '/', sameSite: 'lax' })
  // Cookies should be limited to 4kb, about 1,000-4000 characters
}

export function remove_cached_user() {
  localStorage.removeItem(USER_LOCAL_STORAGE_KEY)

  const yearsAgo = new Date(0)
  set_cookie(ACCESS_TOKEN_COOKIE_NAME, '', { expires: yearsAgo, path: '/', sameSite: 'lax' })
  set_cookie(REFRESH_TOKEN_COOKIE_NAME, '', { expires: yearsAgo, path: '/', sameSite: 'lax' })
}

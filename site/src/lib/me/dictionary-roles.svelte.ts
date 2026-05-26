import type { MyDictionaryRolesResponseBody } from '$api/me/dictionary-roles/+server'
import { browser } from '$app/environment'
import { api_me_dictionary_roles } from '$api/me/dictionary-roles/_call.js'

/**
 * Client-side reactive cache for `/api/me/dictionary-roles` (Story B.6).
 *
 * Persists the last successful response to `localStorage` keyed by user_id
 * (multi-account browsers don't cross-contaminate) and surfaces it as a
 * Svelte 5 `$state` so components stay reactive across re-renders + tabs.
 *
 * Refresh semantics:
 *   - on app boot if stale > REFRESH_AFTER_MS (default 1 hour)
 *   - on manual `refresh()` call
 *   - on login (user_id changes from null → value)
 *   - on logout (`forget()` called)
 *
 * Stale-cache trade-off (admin grants a new role mid-session): the dict is
 * still URL-reachable + the push endpoint does a fresh role lookup (B.5) so
 * security is unaffected; the cache just hasn't surfaced the new badge yet.
 */

const STORAGE_PREFIX = 'ld_dict_roles_v1_for_user_'
const REFRESH_AFTER_MS = 60 * 60 * 1000 // 1 hour

export interface MyDictionaryRolesCache {
  readonly fetched_at: string | null
  readonly roles: MyDictionaryRolesResponseBody['roles']
  readonly is_loading: boolean
  readonly last_error: string | null
  /** Force a refetch (e.g. after the user accepts an invite). */
  refresh: () => Promise<void>
  /** Refetch if older than `REFRESH_AFTER_MS`. */
  refresh_if_stale: () => Promise<void>
  /** Wipe cached state + drop the localStorage entry (call on logout). */
  forget: () => void
  /** Switch which user_id the cache is keyed under (call on login). */
  set_user: (user_id: string | null) => void
}

class DictionaryRolesCacheImpl implements MyDictionaryRolesCache {
  #user_id = $state<string | null>(null)
  #roles = $state<MyDictionaryRolesResponseBody['roles']>([])
  #fetched_at = $state<string | null>(null)
  #is_loading = $state(false)
  #last_error = $state<string | null>(null)

  get roles() { return this.#roles }
  get fetched_at() { return this.#fetched_at }
  get is_loading() { return this.#is_loading }
  get last_error() { return this.#last_error }

  set_user(user_id: string | null) {
    if (user_id === this.#user_id)
      return
    this.#user_id = user_id
    if (!user_id) {
      this.#roles = []
      this.#fetched_at = null
      this.#last_error = null
      return
    }
    this.#hydrate_from_storage(user_id)
  }

  #hydrate_from_storage(user_id: string) {
    if (!browser)
      return
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + user_id)
      if (!raw)
        return
      const parsed = JSON.parse(raw) as MyDictionaryRolesResponseBody
      this.#roles = parsed.roles
      this.#fetched_at = parsed.fetched_at
    } catch (err) {
      console.warn('[dict-roles] failed to hydrate from localStorage:', err)
    }
  }

  #persist() {
    if (!browser || !this.#user_id)
      return
    try {
      localStorage.setItem(
        STORAGE_PREFIX + this.#user_id,
        JSON.stringify({ fetched_at: this.#fetched_at, roles: this.#roles } satisfies MyDictionaryRolesResponseBody),
      )
    } catch (err) {
      // QuotaExceededError, private mode, etc. — silent: in-memory state still works for this session.
      console.warn('[dict-roles] failed to persist to localStorage:', err)
    }
  }

  async refresh() {
    if (this.#is_loading || !this.#user_id)
      return
    this.#is_loading = true
    this.#last_error = null
    const { data, error } = await api_me_dictionary_roles()
    this.#is_loading = false
    if (error) {
      this.#last_error = error.message
      return
    }
    this.#roles = data.roles
    this.#fetched_at = data.fetched_at
    this.#persist()
  }

  async refresh_if_stale() {
    if (!this.#user_id)
      return
    if (!this.#fetched_at) {
      await this.refresh()
      return
    }
    const age_ms = Date.now() - new Date(this.#fetched_at).getTime()
    if (age_ms > REFRESH_AFTER_MS)
      await this.refresh()
  }

  forget() {
    const user_id = this.#user_id
    this.#user_id = null
    this.#roles = []
    this.#fetched_at = null
    this.#last_error = null
    if (browser && user_id) {
      try {
        localStorage.removeItem(STORAGE_PREFIX + user_id)
      } catch {
        // ignore
      }
    }
  }
}

let browser_singleton: DictionaryRolesCacheImpl | null = null

/**
 * Process-wide singleton on the client. Server-side returns a fresh instance
 * per render so SSR doesn't leak state between concurrent requests (same
 * pattern as `lib/auth/user.svelte.ts`).
 */
export function get_my_dictionary_roles(): MyDictionaryRolesCache {
  if (typeof window === 'undefined')
    return new DictionaryRolesCacheImpl()
  if (!browser_singleton)
    browser_singleton = new DictionaryRolesCacheImpl()
  return browser_singleton
}

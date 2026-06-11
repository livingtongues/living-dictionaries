import type { DictionariesResponseBody } from './+server'
import { get_request } from '$lib/utils/requests'

export type DictionaryVisibility = 'public' | 'private' | 'all'

/**
 * Read the dictionary catalog list from shared.db. `private`/`all` are only
 * meaningful for admins — access control rides on the calling page.
 *
 * Pass a load's injected `fetch` (`{ fetch }`) when calling from a `+page.ts` /
 * `+layout.ts` load so SSR keeps the direct-handler + HTML-inlining optimization.
 */
export async function api_dictionaries_list(visibility: DictionaryVisibility, options?: { fetch?: typeof fetch }) {
  return await get_request<DictionariesResponseBody>(`/api/dictionaries?visibility=${visibility}`, options)
}

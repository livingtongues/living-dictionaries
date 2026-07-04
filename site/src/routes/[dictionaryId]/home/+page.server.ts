import { existsSync } from 'node:fs'
import type { PageServerLoadEvent } from './$types'
import type { DictHomeCard } from '$lib/db/server/dict-home'
import { dictionary_db_path, get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_featured_cards, get_recent_cards } from '$lib/db/server/dict-home'
import { get_shared_db } from '$lib/db/server/shared-db'

/**
 * SSR data for the dictionary home page. Featured + recent cards come from the
 * server's copy of `dictionaries/{id}.db` so the page paints instantly — first
 * visits have no local snapshot yet, and the live dict_db takes over client-side
 * once it opens. Cheap indexed reads (see `$lib/db/server/dict-home.ts`).
 *
 * `existsSync` guard: `get_dictionary_db` CREATES the file when missing, which
 * would litter dev machines with empty dict DBs for every visited dictionary.
 *
 * (Typed via the event, not `: PageServerLoad` — with no sibling `+page.ts` the
 * generated PageServerLoad output constraint demands the universal-layout keys.)
 */
export async function load({ parent }: PageServerLoadEvent) {
  const { dictionary } = await parent()

  let ssr_featured: DictHomeCard[] = []
  let ssr_recent: DictHomeCard[] = []
  if (existsSync(dictionary_db_path(dictionary.id))) {
    const db = get_dictionary_db(dictionary.id)
    ssr_featured = get_featured_cards({ db })
    ssr_recent = get_recent_cards({ db })
  }

  const partners = get_shared_db()
    .prepare('SELECT id, name FROM dictionary_partners WHERE dictionary_id = ? ORDER BY created_at ASC')
    .all(dictionary.id) as { id: string, name: string }[]

  return { ssr_featured, ssr_recent, partners }
}

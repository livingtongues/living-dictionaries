import { existsSync } from 'node:fs'
import type { PageServerLoadEvent } from './$types'
import type { DictHomeCard } from '$lib/db/server/dict-home'
import { dictionary_db_path, get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_featured_cards, get_grammar_intro_markdown, get_recent_cards } from '$lib/db/server/dict-home'
import { get_shared_db } from '$lib/db/server/shared-db'
import { stream } from '$lib/server/stream-load'

export interface DictHomeData {
  ssr_featured: DictHomeCard[]
  ssr_recent: DictHomeCard[]
  partners: { id: string, name: string }[]
  /** Grammar-intro markdown from the section tree (falls back to the legacy blob); source for the home teaser. */
  grammar_source: string
}

/**
 * SSR data for the dictionary home page. Featured + recent cards come from the
 * server's copy of `dictionaries/{id}.db` so the page paints instantly — first
 * visits have no local snapshot yet, and the live dict_db takes over client-side
 * once it opens. Cheap indexed reads (see `$lib/db/server/dict-home.ts`).
 *
 * Streamed ONLY on client-nav data requests (`isDataRequest`) so navigation
 * transitions instantly on a slow link; SSR hard loads return the resolved value
 * — this is a PUBLIC, SEO-relevant page, so the crawlable HTML must keep the
 * featured/recent content (a streamed promise would SSR the pending branch).
 * Consumed via `stream_resolve` in the page.
 *
 * `existsSync` guard: `get_dictionary_db` CREATES the file when missing, which
 * would litter dev machines with empty dict DBs for every visited dictionary.
 *
 * (Typed via the event, not `: PageServerLoad` — with no sibling `+page.ts` the
 * generated PageServerLoad output constraint demands the universal-layout keys.)
 */
export async function load({ parent, isDataRequest }: PageServerLoadEvent) {
  const { dictionary } = await parent()

  const compute = (): DictHomeData => {
    let ssr_featured: DictHomeCard[] = []
    let ssr_recent: DictHomeCard[] = []
    let grammar_source = ''
    if (existsSync(dictionary_db_path(dictionary.id))) {
      const db = get_dictionary_db(dictionary.id)
      ssr_featured = get_featured_cards({ db })
      ssr_recent = get_recent_cards({ db })
      grammar_source = get_grammar_intro_markdown({ db, gloss_languages: dictionary.gloss_languages ?? [] })
    }

    const partners = get_shared_db()
      .prepare('SELECT id, name FROM dictionary_partners WHERE dictionary_id = ? ORDER BY created_at ASC')
      .all(dictionary.id) as { id: string, name: string }[]

    return { ssr_featured, ssr_recent, partners, grammar_source }
  }

  return { home_data: isDataRequest ? stream(compute) : compute() }
}

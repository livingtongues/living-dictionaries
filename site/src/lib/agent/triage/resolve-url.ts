import type Database from 'better-sqlite3'

/**
 * Resolve the page URL a customer was on (the thread's `url`) into a
 * human-readable context line for the classifier prompt — so Grok never has to
 * open a browser. Read-only shared.db lookups only.
 *
 * LD route grammar (see `src/routes/`):
 *   /                                  the dictionaries globe (home)
 *   /about /tutorials /account ...     top-level app pages
 *   /dictionaries                      the public dictionary directory
 *   /create-dictionary                 the create-a-dictionary flow
 *   /{dictionaryId}                    a dictionary's landing page
 *   /{dictionaryId}/{section}          entries | entry | settings | about |
 *                                      contributors | grammar | history |
 *                                      export | import | invite
 *   /{dictionaryId}/entry/{entryId}    a single entry detail page
 *
 * `{dictionaryId}` is either the dictionaries.id or its url slug.
 */

const APP_PAGES: Record<string, string> = {
  '': 'the dictionaries globe (home page)',
  'about': 'the About page',
  'tutorials': 'the Tutorials page',
  'dictionaries': 'the public dictionary directory',
  'account': 'their account page',
  'create-dictionary': 'the "create a dictionary" page',
  'globe': 'the dictionaries globe',
  'terms': 'the terms page',
  'privacy-policy': 'the privacy policy page',
}

const DICTIONARY_SECTIONS: Record<string, string> = {
  entries: 'browsing the entries list',
  entry: 'viewing an entry',
  settings: 'the dictionary settings page',
  about: 'the dictionary about page',
  contributors: 'the contributors page',
  grammar: 'the grammar page',
  history: 'the edit-history page',
  export: 'the export page',
  import: 'the import page',
  invite: 'the invite page',
}

interface DictRow { name: string }

function dictionary_label({ db, id_or_slug }: { db: Database.Database, id_or_slug: string }): string | null {
  const row = db.prepare('SELECT name FROM dictionaries WHERE id = ? OR url = ? LIMIT 1')
    .get(id_or_slug, id_or_slug) as DictRow | undefined
  return row?.name ?? null
}

export function resolve_page_context({ url, db }: { url: string | null | undefined, db: Database.Database }): string | null {
  if (!url)
    return null
  let path: string
  try {
    path = url.startsWith('http') ? new URL(url).pathname : url
  } catch {
    return null
  }
  const segs = path.split('/').map(s => s.trim()).filter(Boolean).map(decodeURIComponent)

  // Top-level app pages.
  if (segs.length === 0)
    return APP_PAGES['']
  if (segs.length === 1 && segs[0] in APP_PAGES)
    return APP_PAGES[segs[0]]
  if (segs[0].startsWith('.well-known'))
    return null

  // Dictionary pages: /{dictionaryId}/...
  const [dict_seg, section] = segs
  const name = dictionary_label({ db, id_or_slug: dict_seg })
  const dict_label = name ? `the "${name}" dictionary` : `a dictionary (${dict_seg})`

  if (!section)
    return `${dict_label} landing page`

  if (section === 'entry' && segs[2])
    return `${dict_label}, viewing a specific entry`

  const section_label = DICTIONARY_SECTIONS[section]
  if (section_label)
    return `${dict_label} — ${section_label}`

  return dict_label
}

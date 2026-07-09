import type { RequestHandler } from './$types'
import { get_shared_db } from '$lib/db/server/shared-db'

/**
 * llms.txt (https://llmstxt.org) — a markdown map of the site for AI answer engines
 * and agents: what Living Dictionaries is, the URL shapes worth crawling/citing, and
 * (most importantly) the v1 agent API, which is the surface an LLM should actually
 * use to read or write dictionary data. Live counts come from shared.db.
 */
export const GET: RequestHandler = ({ url }) => {
  const { origin } = url
  const { dictionary_count, entry_count } = get_shared_db()
    .prepare('SELECT COUNT(*) AS dictionary_count, COALESCE(SUM(entry_count), 0) AS entry_count FROM dictionaries WHERE public = 1')
    .get() as { dictionary_count: number, entry_count: number }

  const body = `# Living Dictionaries

> Collaborative multimedia dictionaries built by communities speaking endangered and
> under-represented languages. A free platform by the Living Tongues Institute for
> Endangered Languages (https://livingtongues.org). Currently ${dictionary_count} public
> dictionaries with ${entry_count} entries — words and phrases with translations
> (glosses) in major languages, audio from native speakers, photos, and example sentences.

## Site structure

- [List of all public dictionaries](${origin}/dictionaries): every dictionary with entry
  counts, ISO 639-3 codes, Glottocodes, and coordinates
- Dictionary pages: \`${origin}/{dictionary}/entries\` (browse/search),
  \`${origin}/{dictionary}/about\`, \`${origin}/{dictionary}/grammar\`
- Entry pages: \`${origin}/{dictionary}/entry/{id}\` — one word/phrase with its
  translations, phonetic transcription, audio, photos, and semantic domains (also
  described as schema.org DefinedTerm JSON-LD)
- [Sitemap](${origin}/sitemap.xml): every public dictionary and entry URL
- [About the platform](${origin}/about)

## Agent API (recommended for programmatic access)

Agents should prefer the v1 API over scraping — it can do anything a human editor can:

- [API landing](${origin}/api/v1): how auth and the import workflow function
- [OpenAPI spec](${origin}/api/v1/openapi.json): the full self-describing reference —
  fetch this and self-configure
- Read access to a dictionary's entries, senses, sentences, texts, speakers, media, and
  more; write access with a read & write key
- API keys are minted per dictionary on its Agents page (\`${origin}/{dictionary}/agents\`)
  by dictionary managers

## Citation

Each dictionary provides a citation on its pages. Please cite the specific Living
Dictionary and the Living Tongues Institute for Endangered Languages when quoting content.
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=604800',
    },
  })
}

import type { PageServerLoadEvent } from './$types'
import type { DictionaryCatalogMetadata, DictionaryCoordinates } from '$lib/db/schemas/shared.types'
import { get_shared_db } from '$lib/db/server/shared-db'

export interface SsrDictionaryRow {
  url: string
  name: string
  entry_count: number
  iso_639_3: string | null
  glottocode: string | null
  location: string | null
  coordinates: DictionaryCoordinates | null
  metadata: DictionaryCatalogMetadata | null
}

function parse_json<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

/**
 * SSR the public catalog (only the 8 displayed columns) so the dictionaries table is
 * crawlable — this page is the internal-link hub that leads crawlers into every
 * dictionary. The client-side store takes over once loaded (admin view + CSV export).
 */
export function load(_event: PageServerLoadEvent) {
  const rows = get_shared_db()
    .prepare('SELECT id, url, name, entry_count, iso_639_3, glottocode, location, coordinates, metadata FROM dictionaries WHERE public = 1 ORDER BY name COLLATE NOCASE')
    .all() as (Record<string, string | null> & { entry_count: number })[]

  const ssr_dictionaries: SsrDictionaryRow[] = rows.map(row => ({
    url: row.url ?? row.id,
    name: row.name,
    entry_count: row.entry_count,
    iso_639_3: row.iso_639_3,
    glottocode: row.glottocode,
    location: row.location,
    coordinates: parse_json<DictionaryCoordinates>(row.coordinates),
    metadata: parse_json<DictionaryCatalogMetadata>(row.metadata),
  }))

  return { ssr_dictionaries }
}

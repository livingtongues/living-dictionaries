import type Database from 'better-sqlite3'

/**
 * Pure source-slug helpers shared by the entry/sentence write path
 * (`v1-entry-write.ts`) and the sources sub-resource (`v1-sources.ts`). Kept in
 * a dependency-free module so neither of those forms an import cycle.
 */

export function load_source_slug_set(db: Database.Database): Set<string> {
  const rows = db.prepare(`SELECT slug FROM sources`).all() as { slug: string }[]
  return new Set(rows.map(row => row.slug))
}

/** Throws on the first slug not present in `known` — the strict-write guard. */
export function assert_known_source_slugs(slugs: string[] | undefined, known: Set<string>): void {
  for (const slug of slugs ?? []) {
    if (!known.has(slug))
      throw new Error(`unknown source slug '${slug}'; create it via POST /dictionaries/{id}/sources first`)
  }
}

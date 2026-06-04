/**
 * Types shared between the per-dictionary Drizzle schema and runtime code.
 * Referenced via `$type<>()` annotations on JSON-mode columns in
 * `./dictionary.ts` and matched at runtime by the dictionary-json-columns
 * auto-parse driver.
 */

/**
 * Multi-string blob (a value indexed by language code, e.g. BCP-47 or the
 * dict's custom orthography slug). Used for headwords, definitions, glosses,
 * sentence text, etc. Empty values are omitted on write to keep payloads small.
 */
export type MultiString = Record<string, string>

/**
 * Hosted-elsewhere video reference, AS STORED in `videos.hosted_elsewhere`.
 * The Supabase→SQLite migration preserved the legacy value verbatim — the real
 * shape is `{ type, video_id, start_at_seconds? }` (see old-site
 * `parse-hosted-video-url.ts` + its tests), NOT `{ provider, id, url }`.
 */
export interface HostedElsewhere {
  /** Embed renderer to use. */
  type: 'youtube' | 'vimeo'
  /** Provider-specific id (youtube watch id, vimeo numeric id). */
  video_id: string
  /** Optional start offset in seconds (youtube `?t=`). */
  start_at_seconds?: number
}

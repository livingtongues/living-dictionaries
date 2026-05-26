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

/** Hosted-elsewhere video reference (legacy LD shape preserved). */
export interface HostedElsewhere {
  /** 'youtube' | 'vimeo' | ... — controls embed renderer. */
  provider: string
  /** Provider-specific id (youtube watch id, vimeo numeric id, ...). */
  id: string
  /** Optional canonical URL. */
  url?: string
}

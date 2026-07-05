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
 * One tokenized word/phrase occurrence within a sentence's text for a single
 * orthography. `start`/`end` are char offsets into that orthography's text.
 * Punctuation tokens are emitted with `status: 'ignored'` so offsets and
 * timing arrays stay complete.
 */
export interface SentenceToken {
  /** Surface form exactly as it appears in the sentence text. */
  form: string
  start: number
  end: number
  /** Matched/linked entry (single unambiguous match or a confirmed link). */
  entry_id?: string
  /** Set when a human confirms a sense-level link (mirrored to `senses_in_sentences`). */
  sense_id?: string
  /** Candidate entry ids when the auto-matcher found multiple (homographs). */
  candidates?: string[]
  /** absent = unmatched; 'auto' = machine-matched, unconfirmed. */
  status?: 'auto' | 'confirmed' | 'ignored'
}

/** `sentences.tokens` — orthography code → token list. */
export type SentenceTokens = Record<string, SentenceToken[]>

/**
 * `audio.timings` / `videos.timings` — sentence id → compact word-timing
 * string ("offset,duration|offset,duration|", tutor's parse-words format).
 * Entries align 1:1 with that sentence's default-orthography tokens; offset is
 * relative to the end of the previous timed token (chainable across sentences
 * for text-level media); empty entry = untimed token (punctuation).
 */
export type MediaTimings = Record<string, string>

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

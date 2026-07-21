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
 * One word-INTERNAL segment of a token, for polysynthetic/agglutinative data
 * (affixes/clitics/reduplication). Optional and ignorable for isolating
 * languages, which need only the token-level `gloss`. Present so the model is
 * Leipzig-complete.
 */
export interface Morpheme {
  /** The morpheme's surface form. */
  form: string
  /** Aligned interlinear gloss for this morpheme, per analysis language. */
  gloss?: MultiString
  /** Optional link to a headword (independent of `gloss`). */
  entry_id?: string
  /**
   * Leipzig boundary PRECEDING this morpheme: `-` affix, `=` clitic, `~`
   * reduplication, `.` one-form-many-glosses. Omit for the root/first morpheme.
   */
  separator?: '-' | '=' | '~' | '.'
}

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
  /**
   * Aligned interlinear gloss (the Leipzig gloss line), per analysis language.
   * Independent of `entry_id` (grammatical morphemes/portmanteaux have no
   * headword but must still be glossable). CONVENTION: store language-neutral
   * grammatical category codes (`3PL`/`PFV`) under the reserved `default` key and
   * per-language LEXICAL glosses under language codes; render `gloss[selected] ??
   * gloss.default` so a neutral code survives a gloss-language switch. A code
   * present in `glossing_abbreviations` renders SMALL CAPS + tap-to-expand
   * (matched as a substring, so portmanteaux like `eat PFV` still highlight).
   */
  gloss?: MultiString
  /** Optional word-internal segmentation for polysynthetic/agglutinative data. */
  morphemes?: Morpheme[]
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
 * `sentences.citations` — a source reference WITH a citation locus (page /
 * example number). Complements the bare `sentences.sources[]` slug membership;
 * a SEPARATE column so the shared array-of-slug path (validation, integrity
 * sweeps) stays untouched.
 */
export interface SourceCitation {
  /** An existing `sources.slug`. */
  slug: string
  /** Page / example number / "as quoted from X 1981:31" note. */
  locator?: string
}

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
 * The legacy-platform migration preserved the stored value verbatim — the real
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

/** Best-effort cached metadata for a `videos.hosted_elsewhere` reference. */
export interface HostedMetadata {
  title?: string
  description?: string
  thumbnail_url?: string
  duration_seconds?: number
}

/**
 * Types shared between Drizzle schema and runtime code for `shared.db`.
 * These are referenced via `$type<>()` annotations on JSON-mode columns in
 * `./shared.ts` and matched at runtime by the auto-parse driver in
 * `./json-columns.ts`.
 */

/**
 * One linked auth identity on a `users.providers` array entry.
 *   - `provider` = 'email' | 'google' | 'apple' | etc.
 *   - `provider_id` = lowercased email for `'email'`, verified `sub` for OAuth.
 */
export interface UserProviderIdentity {
  provider: string
  provider_id: string
}

/** Severity level for `client_logs` rows. */
export type ClientLogLevel = 'error' | 'warn' | 'info' | 'unhandled_rejection' | 'crash'

/**
 * Coordinates blob on dictionary catalog rows. Shape matches legacy LD
 * (`@living-dictionaries/types` `Coordinates`/`IPoint`/`IRegion`) EXACTLY so
 * the Supabase→new-site migration can copy this JSON blob verbatim with no
 * transform and no data loss. Kept as a local copy (not imported from the
 * legacy types package) to keep the new site's types self-contained.
 *
 * ⚠ Do NOT flatten `points` or drop `label`/`color` — they're real used data
 * (legacy map fill color + the where-spoken editor). See
 * `.issues/port-homepage-and-auth-chrome.md`.
 */
export interface DictionaryCoordinates {
  points?: { coordinates: { longitude: number, latitude: number }, label?: string, color?: string }[]
  regions?: { coordinates: { longitude: number, latitude: number }[], label?: string, color?: string }[]
}

/**
 * Per-dictionary orthography (writing system) entry. The registry is an ordered
 * list; each entry's `code` is the IMMUTABLE key its text lives under in the
 * `lexeme` / sentence `text` MultiString blobs.
 *
 * The primary/canonical headword is always registry slot 0 with `code: 'default'`
 * and `primary: true` — pinned first, non-deletable, and guaranteed present so the
 * app-wide `lexeme.default` accessor never breaks (it may be synthesized for dicts
 * that have never configured a primary label). Alternate orthographies follow and
 * carry a BCP-47 `code` (which also drives the Keyman keyboard) or a custom slug.
 */
export interface Orthography {
  /**
   * Immutable storage key in the lexeme/text MultiString. `'default'` for the
   * primary; a BCP-47 tag (e.g. `tlh-Latn`) or a custom slug for alternates.
   * Never changes once set (renaming edits `name`, not `code`).
   */
  code: string
  /** Editable display label shown in the UI. Empty → a generic fallback label. */
  name: string
  /** Optional BCP-47 tag driving the Keyman keyboard (equals `code` for bcp-keyed alternates). */
  bcp?: string
  /** Optional notes from the editor. */
  notes?: string
  /** True only for the pinned slot-0 primary (whose `code` is always `'default'`). */
  primary?: boolean
}

/** Reserved primary/canonical headword code — always present, pinned, non-deletable. */
export const PRIMARY_ORTHOGRAPHY_CODE = 'default'

/** Featured image blob on dictionary catalog rows. */
export interface FeaturedImage {
  storage_path?: string
  serving_url?: string
  width?: number
  height?: number
}

/** Dictionary catalog metadata (legacy `dictionaries.metadata` JSON). */
export interface DictionaryCatalogMetadata {
  url?: string
  publish_year?: number
  population?: number
  thumbnail?: string
  type?: string
}

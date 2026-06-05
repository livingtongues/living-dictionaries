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

/** Per-dictionary orthography entry — a BCP-47 key or a custom label. */
export interface Orthography {
  /** Display name shown in the UI. */
  name: string
  /** Optional BCP-47 tag this orthography maps to (e.g. `tlh-Latn`). */
  bcp?: string
  /** Optional notes from the editor. */
  notes?: string
}

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

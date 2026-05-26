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

/** Coordinates blob on dictionary catalog rows (legacy LD shape preserved). */
export interface DictionaryCoordinates {
  /** Centroid lat/lng of the language community. */
  latitude?: number
  longitude?: number
  /** Optional bounding box (sw/ne lat-lng pairs). */
  points?: { latitude: number, longitude: number }[]
  regions?: { id?: string, coordinates: { latitude: number, longitude: number }[] }[]
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

/** Catch-all dictionary catalog metadata (legacy `dictionaries.metadata` JSON). */
export type DictionaryCatalogMetadata = Record<string, unknown>

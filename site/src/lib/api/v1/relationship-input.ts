import type { MultiString } from '$lib/types'

/**
 * Public, agent-facing input + read shapes for `/api/v1` entry relationships.
 * The server maps these onto the `entry_relationships` dict.db row (see
 * `db/server/v1-relationship-write.ts`).
 */

export interface CustomRelationshipTypeInput {
  /** Display label the dictionary creator authors (their language). string → `{ default: … }`. */
  name: MultiString | string
  /** Label shown from the `to` side for a DIRECTED custom type. Omit for symmetric. */
  inverse_name?: MultiString | string
  /** true = symmetric (same label both ways). Defaults to true when no `inverse_name` is given. */
  symmetric?: boolean
}

export interface RelationshipInput {
  from_entry_id: string
  /** Narrow the `from` side to one sense. Omit → whole-entry. Must belong to `from_entry_id`. */
  from_sense_id?: string
  to_entry_id: string
  /** Narrow the `to` side to one sense. Omit → whole-entry. Must belong to `to_entry_id`. */
  to_sense_id?: string
  /** A global relationship-type slug (see `RELATIONSHIP_TYPES`). Provide THIS or `custom_type`. */
  type?: string
  /** A per-dictionary custom type — found-or-created (deduped by name). Provide THIS or `type`. */
  custom_type?: CustomRelationshipTypeInput
  /** Optional freeform note. string → `{ default: … }`. */
  note?: MultiString | string
  /** `sources.slug` refs — each must already exist (create via POST …/sources first). */
  sources?: string[] | string
}

export interface RelationshipTypeRecord {
  id: string
  name: MultiString
  inverse_name: MultiString | null
  symmetric: boolean
}

/**
 * One relationship as seen FROM a given entry: `direction` is relative to the
 * viewpoint entry, and `label_key` (globals) / `name` (custom) already reflect the
 * side being shown (forward vs inverse). `related` is the OTHER endpoint — enough
 * to render a jump link.
 */
export interface RelationshipView {
  id: string
  /** Global slug, or the custom type id when `custom` is true. */
  type: string
  custom: boolean
  symmetric: boolean
  direction: 'forward' | 'inverse'
  /** Globals only: i18n key `relationship_type.<slug>` for the side being viewed. */
  label_key?: string
  /** Custom types only: the display label for the side being viewed. */
  name?: MultiString
  related: {
    entry_id: string
    sense_id?: string
    lexeme: MultiString
  }
  note?: MultiString
  sources?: string[]
}

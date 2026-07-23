import type Database from 'better-sqlite3'
import type { Orthography } from '$lib/db/schemas/shared.types'
import { PRIMARY_ORTHOGRAPHY_CODE } from '$lib/db/schemas/shared.types'
import { additional_keyboards, glossing_languages } from '$lib/glosses/glossing-languages'
import keyman_writing_systems from '$lib/components/keyboards/keyman/keyman-writing-systems.json'
import { get_dictionary_db } from './dictionary-db'
import { get_shared_db } from './shared-db'
import { get_orthographies } from '$lib/orthography/orthographies'

/**
 * Orthography (writing-system) registry management. The registry lives on
 * `shared.db.dictionaries.orthographies` (catalog JSON), NOT the per-dict db —
 * so writes go straight to shared.db (like other catalog settings), while the
 * delete-guard "is this code in use?" scan reads the per-dict `entries.lexeme` +
 * `sentences.text`. Shared by the `/api/v1` orthography endpoints (agents) and
 * the settings-page catalog write (humans) so both validate identically.
 */

/** slug (`village-spelling`) or BCP-47 tag (`sat-Olck`). */
const CODE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/i

export interface OrthographyUsage { entries: number, sentences: number }

export interface OrthographyWithUsage extends Orthography {
  used_by: OrthographyUsage
}

const keyman_tags = keyman_writing_systems as Record<string, { id: string, name: string, font?: string }>

/** True when `code` is already a known writing-system tag in one of our lists. */
export function is_known_writing_system(code: string): boolean {
  return !!(glossing_languages[code] || additional_keyboards[code] || keyman_tags[code])
}

/** True when `code` is reserved and can never be a custom alternate code. */
export function is_reserved_code(code: string): boolean {
  return code === PRIMARY_ORTHOGRAPHY_CODE || /^lo\d+$/.test(code)
}

/**
 * Validate a whole orthographies array written wholesale (the settings-page
 * catalog path). Throws on a malformed/duplicate/reserved code so the human
 * write path gets the same guardrails as the granular v1 endpoints.
 */
export function validate_orthographies_array(orthographies: unknown): Orthography[] {
  if (orthographies === null || orthographies === undefined) return []
  if (!Array.isArray(orthographies)) throw new Error('orthographies must be an array')
  const seen = new Set<string>()
  for (const orthography of orthographies) {
    if (!orthography || typeof orthography !== 'object') throw new Error('each orthography must be an object')
    const { code } = orthography as { code?: unknown }
    if (typeof code !== 'string' || !code) throw new Error('each orthography needs a code')
    if (code !== PRIMARY_ORTHOGRAPHY_CODE) {
      if (!CODE_PATTERN.test(code)) throw new Error(`invalid orthography code "${code}"`)
      if (is_reserved_code(code)) throw new Error(`reserved orthography code "${code}"`)
    }
    const key = code.toLowerCase()
    if (seen.has(key)) throw new Error(`duplicate orthography code "${code}"`)
    seen.add(key)
  }
  return orthographies as Orthography[]
}

/** How many entries / sentences actually store text under `code` (non-empty). */
export function count_orthography_usage({ dict_db, code }: { dict_db: Database.Database, code: string }): OrthographyUsage {
  const scan = (table: 'entries' | 'sentences', column: 'lexeme' | 'text') => {
    const row = dict_db.prepare(
      `SELECT COUNT(*) AS c FROM "${table}" WHERE ${column} IS NOT NULL AND EXISTS (
         SELECT 1 FROM json_each("${table}".${column}) WHERE key = ? AND value IS NOT NULL AND value != ''
       )`,
    ).get(code) as { c: number }
    return row.c
  }
  return { entries: scan('entries', 'lexeme'), sentences: scan('sentences', 'text') }
}

function read_orthographies(dict_id: string): Orthography[] {
  const row = get_shared_db().prepare('SELECT orthographies FROM dictionaries WHERE id = ?').get(dict_id) as { orthographies: string | null } | undefined
  if (!row) throw new Error('dictionary not found')
  return row.orthographies ? JSON.parse(row.orthographies) as Orthography[] : []
}

/** Persist the registry to shared.db (mirrors the catalog endpoint: dirty + audit). */
function write_orthographies({ dict_id, user_id, orthographies }: { dict_id: string, user_id: string | null, orthographies: Orthography[] }): void {
  get_shared_db().prepare(
    'UPDATE dictionaries SET orthographies = ?, updated_at = ?, updated_by_user_id = ?, dirty = 1 WHERE id = ?',
  ).run(JSON.stringify(orthographies), new Date().toISOString(), user_id, dict_id)
}

/** The alternate orthographies (excludes the pinned primary) each with usage counts. */
export function list_orthographies_with_usage({ dict_id }: { dict_id: string }): OrthographyWithUsage[] {
  const { alternates } = get_orthographies({ orthographies: read_orthographies(dict_id) })
  const dict_db = get_dictionary_db(dict_id)
  return alternates.map(orthography => ({ ...orthography, used_by: count_orthography_usage({ dict_db, code: orthography.code }) }))
}

export interface OrthographyInput {
  code: string
  name?: string
  bcp?: string
  notes?: string
}

/** Validate + normalize a new alternate code (throws on invalid). Auto-wires bcp for known tags. */
function build_alternate({ input, existing }: { input: OrthographyInput, existing: Orthography[] }): Orthography {
  const code = (input.code ?? '').trim()
  if (!code)
    throw new Error('code is required')
  if (!CODE_PATTERN.test(code))
    throw new Error(`invalid code "${code}" — use a BCP-47 tag or a slug (letters, numbers, hyphens)`)
  if (is_reserved_code(code))
    throw new Error(`code "${code}" is reserved`)
  if (existing.some(orthography => orthography.code.toLowerCase() === code.toLowerCase()))
    throw new Error(`code "${code}" already exists`)

  const orthography: Orthography = { code, name: (input.name ?? '').trim() }
  // A code that is itself a known writing system wires its keyboard automatically.
  const bcp = (input.bcp ?? '').trim() || (is_known_writing_system(code) ? code : '')
  if (bcp) orthography.bcp = bcp
  if (input.notes?.trim()) orthography.notes = input.notes.trim()
  return orthography
}

export function create_orthography({ dict_id, user_id, input }: { dict_id: string, user_id: string | null, input: OrthographyInput }): Orthography {
  const existing = read_orthographies(dict_id)
  const orthography = build_alternate({ input, existing })
  write_orthographies({ dict_id, user_id, orthographies: [...existing, orthography] })
  return orthography
}

export interface OrthographyPatch {
  name?: string
  bcp?: string | null
  notes?: string | null
}

/**
 * Rename / re-label an orthography (identified by immutable `code`, incl. the
 * primary `'default'`). `code` itself is never editable. Editing the primary
 * materializes its registry entry if it wasn't stored yet.
 */
export function update_orthography({ dict_id, user_id, code, patch }: { dict_id: string, user_id: string | null, code: string, patch: OrthographyPatch }): Orthography {
  const existing = read_orthographies(dict_id)
  const apply = (orthography: Orthography): Orthography => {
    const next = { ...orthography }
    if (patch.name !== undefined) next.name = patch.name.trim()
    if (patch.bcp !== undefined) {
      if (patch.bcp) next.bcp = patch.bcp.trim()
      else delete next.bcp
    }
    if (patch.notes !== undefined) {
      if (patch.notes) next.notes = patch.notes.trim()
      else delete next.notes
    }
    return next
  }

  const index = existing.findIndex(orthography => orthography.code === code)
  if (index >= 0) {
    const updated = apply(existing[index])
    const orthographies = [...existing]
    orthographies[index] = updated
    write_orthographies({ dict_id, user_id, orthographies })
    return updated
  }
  if (code === PRIMARY_ORTHOGRAPHY_CODE) {
    const primary = apply({ code: PRIMARY_ORTHOGRAPHY_CODE, name: '', primary: true })
    write_orthographies({ dict_id, user_id, orthographies: [primary, ...existing] })
    return primary
  }
  throw new Error(`orthography "${code}" not found`)
}

export function delete_orthography({ dict_id, user_id, code }: { dict_id: string, user_id: string | null, code: string }): OrthographyUsage {
  if (code === PRIMARY_ORTHOGRAPHY_CODE)
    throw new Error('the primary orthography cannot be deleted')
  const existing = read_orthographies(dict_id)
  if (!existing.some(orthography => orthography.code === code))
    throw new Error(`orthography "${code}" not found`)
  const used_by = count_orthography_usage({ dict_db: get_dictionary_db(dict_id), code })
  if (used_by.entries + used_by.sentences > 0)
    throw new Error(`orthography "${code}" is in use (${used_by.entries} entries, ${used_by.sentences} sentences) — clear it from those first`)
  write_orthographies({ dict_id, user_id, orthographies: existing.filter(orthography => orthography.code !== code) })
  return used_by
}

/** Reorder the ALTERNATE orthographies. `order` is the full list of alternate codes. */
export function reorder_orthographies({ dict_id, user_id, order }: { dict_id: string, user_id: string | null, order: string[] }): Orthography[] {
  const existing = read_orthographies(dict_id)
  const primary = existing.find(orthography => orthography.code === PRIMARY_ORTHOGRAPHY_CODE)
  const alternates = existing.filter(orthography => orthography.code !== PRIMARY_ORTHOGRAPHY_CODE)
  const by_code = new Map(alternates.map(orthography => [orthography.code, orthography]))
  if (order.length !== alternates.length || order.some(code => !by_code.has(code)))
    throw new Error('order must list every alternate orthography code exactly once')
  const reordered = order.map(code => by_code.get(code) as Orthography)
  const orthographies = primary ? [primary, ...reordered] : reordered
  write_orthographies({ dict_id, user_id, orthographies })
  return orthographies
}

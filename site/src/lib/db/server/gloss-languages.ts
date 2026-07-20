import { glossing_languages } from '$lib/glosses/glossing-languages'
import { get_dictionary_db } from './dictionary-db'
import { get_shared_db } from './shared-db'

/**
 * Gloss-language registry management. The list lives on
 * `shared.db.dictionaries.gloss_languages` (catalog JSON) — the locale codes an
 * entry's glosses / a sentence's translations are keyed by. Shared by the
 * `/api/v1` gloss-language endpoints (agents) and available to the human catalog
 * write path so both validate identically (per the human/agent parity
 * direction — see AGENTS.md).
 */

export interface GlossLanguageUsage { senses: number, sentences: number }

function read_gloss_languages(dict_id: string): string[] {
  const row = get_shared_db().prepare('SELECT gloss_languages FROM dictionaries WHERE id = ?').get(dict_id) as { gloss_languages: string | null } | undefined
  if (!row) throw new Error('dictionary not found')
  return row.gloss_languages ? JSON.parse(row.gloss_languages) as string[] : []
}

/** Persist the list to shared.db (mirrors the catalog endpoint: dirty + audit). */
function write_gloss_languages({ dict_id, user_id, gloss_languages }: { dict_id: string, user_id: string | null, gloss_languages: string[] }): void {
  get_shared_db().prepare(
    'UPDATE dictionaries SET gloss_languages = ?, updated_at = ?, updated_by_user_id = ?, dirty = 1 WHERE id = ?',
  ).run(JSON.stringify(gloss_languages), new Date().toISOString(), user_id, dict_id)
}

/** True when `code` is in the supported glossing-languages list. */
export function is_valid_gloss_language(code: string): boolean {
  return !!glossing_languages[code]
}

/**
 * How many senses (glosses/definition keys) / sentences (translation keys)
 * actually store text under `code` (non-empty) — the delete guard scan, twin of
 * `count_orthography_usage`.
 */
export function count_gloss_language_usage({ dict_id, code }: { dict_id: string, code: string }): GlossLanguageUsage {
  const dict_db = get_dictionary_db(dict_id)
  const senses = (dict_db.prepare(
    `SELECT COUNT(*) AS c FROM senses WHERE
       (glosses IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(senses.glosses) WHERE key = ? AND value IS NOT NULL AND value != ''))
       OR (definition IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(senses.definition) WHERE key = ? AND value IS NOT NULL AND value != ''))`,
  ).get(code, code) as { c: number }).c
  const sentences = (dict_db.prepare(
    `SELECT COUNT(*) AS c FROM sentences WHERE translation IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(sentences.translation) WHERE key = ? AND value IS NOT NULL AND value != '')`,
  ).get(code) as { c: number }).c
  return { senses, sentences }
}

/** Add a gloss language (validated against the supported list). Idempotent-ish: re-adding throws a clear error. */
export function add_gloss_language({ dict_id, user_id, code }: { dict_id: string, user_id: string | null, code: string }): string[] {
  const trimmed = (code ?? '').trim()
  if (!trimmed)
    throw new Error('code is required')
  if (!is_valid_gloss_language(trimmed))
    throw new Error(`"${trimmed}" is not a supported gloss language code — see the dictionary metadata's gloss_languages for examples; codes come from Living Dictionaries' glossing-languages list`)
  const existing = read_gloss_languages(dict_id)
  if (existing.includes(trimmed))
    throw new Error(`gloss language "${trimmed}" is already on this dictionary`)
  const gloss_languages = [...existing, trimmed]
  write_gloss_languages({ dict_id, user_id, gloss_languages })
  return gloss_languages
}

/** Remove a gloss language. Refused while any sense/sentence still stores text under it. */
export function remove_gloss_language({ dict_id, user_id, code }: { dict_id: string, user_id: string | null, code: string }): string[] {
  const existing = read_gloss_languages(dict_id)
  if (!existing.includes(code))
    throw new Error(`gloss language "${code}" not found on this dictionary`)
  const used_by = count_gloss_language_usage({ dict_id, code })
  if (used_by.senses + used_by.sentences > 0)
    throw new Error(`gloss language "${code}" is in use (${used_by.senses} senses, ${used_by.sentences} sentences) — clear those first`)
  const gloss_languages = existing.filter(existing_code => existing_code !== code)
  write_gloss_languages({ dict_id, user_id, gloss_languages })
  return gloss_languages
}

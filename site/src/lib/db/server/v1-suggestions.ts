import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { SentenceToken, SentenceTokens } from '$lib/db/schemas/dictionary.types'
import type { MultiString } from '$lib/types'
import type { SuggestionFacets } from '$lib/corpus/aggregate-suggestions'
import type { TokenLinkAction } from '$lib/corpus/token-actions'
import { aggregate_suggestions } from '$lib/corpus/aggregate-suggestions'
import { apply_token_action } from '$lib/corpus/token-actions'
import { build_lexeme_index, match_tokens } from '$lib/corpus/match-tokens'
import { tokens_reference_sense } from '$lib/corpus/sentence-analysis'
import { is_punctuation_form, normalized_word_key } from '$lib/corpus/tokenize-sentence'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { delete_dict_row, merge_dict_row } from './dictionary-sync-helpers'
import { record_history } from './dictionary-history-db'
import { mirror_token_sense_links } from './v1-entry-write'

/**
 * Server-side suggestions queue + token/form actions (M4,
 * .issues/texts-sentences-pipeline.md) — the v1 twins of the client worker ops
 * in `dict-writes.ts`. Both surfaces share the SAME pure modules
 * (`aggregate_suggestions`, `apply_token_action`, `match_tokens`), so a human
 * in the queue UI and an agent on the API always agree; the write plumbing here
 * is `merge_dict_row`/`delete_dict_row` (LWW + history + server_seq triggers)
 * instead of the worker's dirty-row path.
 */

type SentenceRow = Record<string, unknown> & {
  id: string
  text_id: string | null
  text: MultiString | null
  tokens: SentenceTokens | null
}

function load_tokenized_sentences(db: Database.Database): SentenceRow[] {
  const rows = db.prepare(`SELECT * FROM sentences WHERE tokens IS NOT NULL`).all() as Record<string, unknown>[]
  return rows.map(row => parse_dict_row('sentences', row) as SentenceRow)
}

/** Full-row token update through the push path (`merge_dict_row` upserts need
 *  every NOT NULL column; `updated_by_user_id` is dropped so the caller is
 *  stamped as the editor). */
function merge_sentence_tokens({ db, sentence, tokens, user_id, at, api_key_id }: {
  db: Database.Database
  sentence: Record<string, unknown>
  tokens: SentenceTokens
  user_id: string
  at: string
  api_key_id?: string | null
}): HistoryEvent | null {
  const row: Record<string, unknown> = { ...sentence, tokens, updated_at: at }
  delete row.updated_by_user_id
  return merge_dict_row({ db, table_name: 'sentences', row, user_id, at, api_key_id })
}

function load_ignored_form_keys(db: Database.Database): Set<string> {
  const rows = db.prepare(`SELECT form FROM ignored_forms`).all() as { form: string }[]
  return new Set(rows.map(row => row.form))
}

function load_lexeme_index_sync(db: Database.Database) {
  const rows = db.prepare(`SELECT id, lexeme FROM entries WHERE lexeme IS NOT NULL`).all() as Record<string, unknown>[]
  return build_lexeme_index(rows.map(row => parse_dict_row('entries', row) as { id: string, lexeme: MultiString | null }))
}

export function get_dictionary_suggestions(db: Database.Database): SuggestionFacets {
  return aggregate_suggestions({
    sentences: load_tokenized_sentences(db),
    ignored_forms: load_ignored_form_keys(db),
  })
}

export interface TokenActionInput {
  orthography: string
  token_index: number
  action: TokenLinkAction
  entry_id?: string
  sense_id?: string
}

export interface FormActionResult {
  found: boolean
  sentences_changed: number
  occurrences: number
  entry_id?: string
  new_synced_up_to: string | null
}

/**
 * Apply review actions to tokens of ONE sentence (v1 twin of the worker's
 * `set_token_link_local`): rewrite the token via `apply_token_action`, mirror
 * confirmed sense links into `senses_in_sentences`, and clean junction rows
 * whose token link vanished (text sentences only — a standalone sentence's
 * junction row may be a curated example link).
 */
export function apply_token_actions({ db, history_db, sentence_id, actions, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  sentence_id: string
  actions: TokenActionInput[]
  user_id: string
  api_key_id?: string | null
}): { found: boolean, new_synced_up_to: string | null } {
  const raw = db.prepare(`SELECT * FROM sentences WHERE id = ?`).get(sentence_id) as Record<string, unknown> | undefined
  if (!raw)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  const row = parse_dict_row('sentences', raw)
  const tokens = (row.tokens ?? {}) as SentenceTokens

  const dropped_sense_ids: string[] = []
  const entry_exists = db.prepare(`SELECT 1 FROM entries WHERE id = ?`)
  for (const { orthography, token_index, action, entry_id, sense_id } of actions) {
    const list = tokens[orthography]
    const token = list?.[token_index]
    if (!token)
      throw new Error(`token not found: ${orthography}[${token_index}]`)
    if (action === 'confirm' && (!entry_id || !entry_exists.get(entry_id)))
      throw new Error(`confirm requires a valid entry_id (${orthography}[${token_index}])`)
    if (token.sense_id && token.sense_id !== sense_id)
      dropped_sense_ids.push(token.sense_id)
    list[token_index] = apply_token_action({ token, action, entry_id, sense_id })
  }

  const now = new Date().toISOString()
  db.exec('BEGIN IMMEDIATE')
  try {
    const events: HistoryEvent[] = []
    const sentence_event = merge_sentence_tokens({ db, sentence: row, tokens, user_id, at: now, api_key_id })
    if (sentence_event)
      events.push(sentence_event)
    events.push(...mirror_token_sense_links({ db, sentence_id, tokens, user_id, at: now, api_key_id }))
    if (row.text_id) {
      for (const sense_id of new Set(dropped_sense_ids)) {
        if (tokens_reference_sense({ tokens, sense_id }))
          continue
        const junction = db.prepare(`SELECT id FROM senses_in_sentences WHERE sentence_id = ? AND sense_id = ?`).get(sentence_id, sense_id) as { id: string } | undefined
        if (!junction)
          continue
        const { event } = delete_dict_row({ db, table_name: 'senses_in_sentences', id: junction.id, user_id, at: now, api_key_id })
        if (event)
          events.push(event)
      }
    }
    const cursor = read_last_modified_at(db)
    db.exec('COMMIT')
    if (history_db && events.length)
      try_record_history(history_db, events)
    return { found: true, new_synced_up_to: cursor }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export type FormAction = 'ignore' | 'restore' | 'link' | 'create_entry'

/**
 * Form-wide queue actions (v1 twins of the worker's `ignore_form_local` /
 * `restore_form_local` / `link_form_local` / `create_entry_from_form_local`) —
 * identical semantics, see those ops for the rules (entry-level confirms only,
 * dictionary-level ignore persistence, restore re-matches).
 */
export function apply_form_action({ db, history_db, action, form, entry_id, lexeme, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  action: FormAction
  form: string
  entry_id?: string
  lexeme?: MultiString
  user_id: string
  api_key_id?: string | null
}): FormActionResult {
  const key = normalized_word_key(form)
  if (!key)
    throw new Error('form has no word characters')

  const now = new Date().toISOString()
  db.exec('BEGIN IMMEDIATE')
  try {
    const events: HistoryEvent[] = []
    let result: { sentences_changed: number, occurrences: number }
    let created_entry_id: string | undefined

    if (action === 'ignore') {
      result = rewrite_form_occurrences({
        db, key, user_id, at: now, api_key_id, events,
        rewrite: token => token.status === 'ignored' && !token.entry_id && !token.candidates
          ? null
          : apply_token_action({ token, action: 'ignore' }),
      })
      if (!db.prepare(`SELECT 1 FROM ignored_forms WHERE form = ?`).get(key)) {
        const event = merge_dict_row({
          db,
          table_name: 'ignored_forms',
          row: { id: crypto.randomUUID(), form: key, created_at: now, updated_at: now },
          user_id,
          at: now,
          api_key_id,
        })
        if (event)
          events.push(event)
      }
    } else if (action === 'restore') {
      drop_ignored_form_row({ db, key, user_id, at: now, api_key_id, events })
      const index = load_lexeme_index_sync(db)
      const ignored_forms = load_ignored_form_keys(db)
      result = rewrite_form_occurrences({
        db, key, user_id, at: now, api_key_id, events,
        only_ignored: true,
        rewrite: token => apply_token_action({ token, action: 'unlink' }),
        rematch: { index, ignored_forms },
      })
    } else {
      if (action === 'create_entry') {
        if (!lexeme || !Object.values(lexeme).some(value => value?.trim()))
          throw new Error('create_entry requires a lexeme')
        created_entry_id = crypto.randomUUID()
        const entry_event = merge_dict_row({ db, table_name: 'entries', row: { id: created_entry_id, lexeme, created_at: now, updated_at: now }, user_id, at: now, api_key_id })
        if (entry_event)
          events.push(entry_event)
        const sense_event = merge_dict_row({ db, table_name: 'senses', row: { id: crypto.randomUUID(), entry_id: created_entry_id, created_at: now, updated_at: now }, user_id, at: now, api_key_id })
        if (sense_event)
          events.push(sense_event)
      } else if (!entry_id || !db.prepare(`SELECT 1 FROM entries WHERE id = ?`).get(entry_id)) {
        throw new Error('link requires a valid entry_id')
      }
      const target_entry_id = created_entry_id ?? entry_id as string
      drop_ignored_form_row({ db, key, user_id, at: now, api_key_id, events })
      result = rewrite_form_occurrences({
        db, key, user_id, at: now, api_key_id, events,
        rewrite: token => apply_token_action({ token, action: 'confirm', entry_id: target_entry_id }),
      })
    }

    const cursor = read_last_modified_at(db)
    db.exec('COMMIT')
    if (history_db && events.length)
      try_record_history(history_db, events)
    return { found: true, ...result, ...(created_entry_id ? { entry_id: created_entry_id } : {}), new_synced_up_to: cursor }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

function drop_ignored_form_row({ db, key, user_id, at, api_key_id, events }: {
  db: Database.Database
  key: string
  user_id: string
  at: string
  api_key_id?: string | null
  events: HistoryEvent[]
}) {
  const persisted = db.prepare(`SELECT id FROM ignored_forms WHERE form = ?`).get(key) as { id: string } | undefined
  if (!persisted)
    return
  const { event } = delete_dict_row({ db, table_name: 'ignored_forms', id: persisted.id, user_id, at, api_key_id })
  if (event)
    events.push(event)
}

/**
 * Shared occurrence sweep: rewrite every matching non-confirmed word token
 * (`rewrite` returns null to skip), optionally restricted to occurrence
 * ignores, optionally re-matching each touched orthography afterwards.
 */
function rewrite_form_occurrences({ db, key, user_id, at, api_key_id, events, rewrite, only_ignored, rematch }: {
  db: Database.Database
  key: string
  user_id: string
  at: string
  api_key_id?: string | null
  events: HistoryEvent[]
  rewrite: (token: SentenceToken) => SentenceToken | null
  only_ignored?: boolean
  rematch?: { index: ReturnType<typeof build_lexeme_index>, ignored_forms: Set<string> }
}): { sentences_changed: number, occurrences: number } {
  let sentences_changed = 0
  let occurrences = 0
  for (const sentence of load_tokenized_sentences(db)) {
    const { tokens } = sentence
    if (!tokens)
      continue
    let changed = false
    for (const [orthography, list] of Object.entries(tokens)) {
      let touched = false
      for (const [index_in_list, token] of list.entries()) {
        if (token.status === 'confirmed' || token.sense_id || is_punctuation_form(token.form))
          continue
        if (only_ignored && (token.status !== 'ignored' || token.entry_id || token.candidates))
          continue
        if (normalized_word_key(token.form) !== key)
          continue
        const replacement = rewrite(token)
        if (!replacement)
          continue
        list[index_in_list] = replacement
        touched = true
        occurrences++
      }
      if (touched && rematch) {
        const text_string = sentence.text?.[orthography] ?? ''
        tokens[orthography] = match_tokens({ tokens: list, text: text_string, index: rematch.index, ignored_forms: rematch.ignored_forms })
      }
      changed ||= touched
    }
    if (!changed)
      continue
    sentences_changed++
    const event = merge_sentence_tokens({ db, sentence, tokens, user_id, at, api_key_id })
    if (event)
      events.push(event)
  }
  return { sentences_changed, occurrences }
}

function try_record_history(history_db: Database.Database, events: HistoryEvent[]) {
  try {
    record_history(history_db, events)
  } catch (err) {
    console.warn('Could not record v1 suggestions history:', err)
  }
}

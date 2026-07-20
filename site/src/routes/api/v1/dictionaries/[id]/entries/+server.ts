import type { RequestHandler } from './$types'
import type { MultiString } from '$lib/types'
import type { EntriesWriteResponseBody, EntryInput } from '$lib/api/v1/entry-input'
import { DEFAULT_LIST_LIMIT, MAX_ENTRIES_PER_REQUEST, MAX_LIST_LIMIT } from '$lib/api/v1/entry-input'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_history_db } from '$lib/db/server/dictionary-history-db'
import { apply_entry_writes } from '$lib/db/server/v1-entry-write'
import { load_v1_dictionary_context, mirror_dictionary_cursor } from '$lib/db/server/v1-route-context'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

export type { EntriesWriteResponseBody }

/** A sense's meaning fields — attached to list rows when `?include=senses`. */
export interface SenseSummary {
  id: string
  glosses: MultiString | null
  definition: MultiString | null
  parts_of_speech: string[] | null
  semantic_domains: string[] | null
}

export interface EntrySummary {
  id: string
  lexeme: MultiString
  /** Homograph number ("1", "2", …) when the dictionary distinguishes identically-spelled headwords. */
  homograph: string | null
  phonetic: string | null
  elicitation_id: string | null
  /** `sources.slug` refs — included unconditionally so provenance checks don't need per-entry detail fetches. */
  sources: string[] | null
  updated_at: string
  /** Present only when the caller passes `?include=senses`. */
  senses?: SenseSummary[]
}

export interface EntriesListResponseBody {
  entries: EntrySummary[]
  /** True when more rows exist past this page (caller should bump `offset`). */
  has_more: boolean
}

/**
 * GET /api/v1/dictionaries/[id]/entries
 *
 * List/filter entry summaries — for idempotency/dedupe + verification + bulk
 * export. Filters (query params): `elicitation_id` (exact), `lexeme` (substring, or
 * exact across locales with `match=exact`), `updated_since` (ISO, exclusive),
 * `limit` (≤500), `offset`. Ordered by
 * `updated_at ASC` so an agent can page incrementally. Pass `?include=senses` to
 * attach each entry's senses (glosses/definition/POS/domains) in ONE batched
 * query — turns a whole-dictionary read from N+1 into a single paged sweep.
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })

  const params = event.url.searchParams
  const where: string[] = []
  const args: (string | number)[] = []

  const elicitation_id = params.get('elicitation_id')
  if (elicitation_id) {
    where.push('elicitation_id = ?')
    args.push(elicitation_id)
  }
  const lexeme = params.get('lexeme')
  if (lexeme) {
    if (params.get('match') === 'exact') {
      // Exact (case-sensitive) match against any locale's spelling in the MultiString.
      where.push('EXISTS (SELECT 1 FROM json_each(entries.lexeme) WHERE json_each.value = ?)')
      args.push(lexeme)
    } else {
      where.push('lexeme LIKE ?')
      args.push(`%${lexeme}%`)
    }
  }
  const updated_since = params.get('updated_since')
  if (updated_since) {
    where.push('updated_at > ?')
    args.push(updated_since)
  }

  const limit = Math.min(Math.max(Number(params.get('limit')) || DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT)
  const offset = Math.max(Number(params.get('offset')) || 0, 0)
  const where_sql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const include_senses = (params.get('include') ?? '').split(',').map(s => s.trim()).includes('senses')

  const db = get_dictionary_db(dictionary.id)
  const rows = db.prepare(
    `SELECT id, lexeme, homograph, phonetic, elicitation_id, sources, updated_at FROM entries
     ${where_sql} ORDER BY updated_at ASC LIMIT ? OFFSET ?`,
  ).all(...args, limit + 1, offset) as { id: string, lexeme: string, homograph: string | null, phonetic: string | null, elicitation_id: string | null, sources: string | null, updated_at: string }[]

  const has_more = rows.length > limit
  const page = rows.slice(0, limit)

  const senses_by_entry = include_senses ? load_senses_for_entries(db, page.map(row => row.id)) : undefined

  const entries: EntrySummary[] = page.map(row => ({
    id: row.id,
    lexeme: JSON.parse(row.lexeme) as MultiString,
    homograph: row.homograph,
    phonetic: row.phonetic,
    elicitation_id: row.elicitation_id,
    sources: row.sources ? JSON.parse(row.sources) as string[] : null,
    updated_at: row.updated_at,
    ...(senses_by_entry ? { senses: senses_by_entry.get(row.id) ?? [] } : {}),
  }))
  return json({ entries, has_more } satisfies EntriesListResponseBody)
}

/** Batch-load senses for a page of entries in one query, grouped by entry id. */
function load_senses_for_entries(db: ReturnType<typeof get_dictionary_db>, entry_ids: string[]): Map<string, SenseSummary[]> {
  const grouped = new Map<string, SenseSummary[]>()
  if (!entry_ids.length)
    return grouped
  const placeholders = entry_ids.map(() => '?').join(',')
  const rows = db.prepare(
    `SELECT id, entry_id, glosses, definition, parts_of_speech, semantic_domains
     FROM senses WHERE entry_id IN (${placeholders}) ORDER BY created_at ASC`,
  ).all(...entry_ids) as { id: string, entry_id: string, glosses: string | null, definition: string | null, parts_of_speech: string | null, semantic_domains: string | null }[]
  for (const row of rows) {
    const list = grouped.get(row.entry_id) ?? []
    list.push({
      id: row.id,
      glosses: row.glosses ? JSON.parse(row.glosses) as MultiString : null,
      definition: row.definition ? JSON.parse(row.definition) as MultiString : null,
      parts_of_speech: row.parts_of_speech ? JSON.parse(row.parts_of_speech) as string[] : null,
      semantic_domains: row.semantic_domains ? JSON.parse(row.semantic_domains) as string[] : null,
    })
    grouped.set(row.entry_id, list)
  }
  return grouped
}

/**
 * POST /api/v1/dictionaries/[id]/entries
 *
 * Bulk-create entries (with nested senses, glosses, example sentences, dialects,
 * tags) through the agent-friendly API. Auth: an `ldk_` API key scoped to this
 * dictionary, or a session/JWT with >= editor role. Writes flow through the same
 * `merge_dict_row` path a browser push uses, so they're indistinguishable from a
 * human edit (history, triggers, peer sync).
 *
 * Body accepts a single entry, a bare array of entries, or
 * `{ entries: [...], import_id? }`. Per-item best-effort; the response reports
 * `{ created, updated, failed, results }`.
 */
export const POST: RequestHandler = async (event) => {
  const { dictionary, access } = await load_v1_dictionary_context({ event, access: 'write' })

  const body = await event.request.json() as unknown
  const { entries, import_id } = normalize_body(body)
  if (!entries.length)
    error(ResponseCodes.BAD_REQUEST, 'no entries provided')
  if (entries.length > MAX_ENTRIES_PER_REQUEST)
    error(ResponseCodes.BAD_REQUEST, `too many entries in one request (max ${MAX_ENTRIES_PER_REQUEST}); split into batches`)

  let report
  try {
    report = apply_entry_writes({
      db: get_dictionary_db(dictionary.id),
      history_db: get_dictionary_history_db(dictionary.id),
      entries,
      user_id: access.user_id,
      import_id,
      api_key_id: access.key_id ?? null,
    })
  } catch (err) {
    log_server_event({ level: 'error', message: 'v1_entries_write_failed', error: err, user_id: access.user_id, context: { dictionary_id: dictionary.id, via: access.via } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `write failed: ${(err as Error).message}`)
  }

  // Mirror the dict cursor to shared.db (same as the /changes push) so the
  // snapshot builder + admin catalog see the dictionary as freshly modified.
  mirror_dictionary_cursor({ dict_id: dictionary.id, cursor: report.new_synced_up_to })

  log_server_event({ level: 'info', message: 'v1_entries_written', user_id: access.user_id, context: { dictionary_id: dictionary.id, via: access.via, created: report.created, skipped: report.skipped, updated: report.updated, failed: report.failed } })

  const { created, skipped, updated, failed, results } = report
  return json({ created, skipped, updated, failed, results } satisfies EntriesWriteResponseBody)
}

function normalize_body(body: unknown): { entries: EntryInput[], import_id?: string } {
  if (Array.isArray(body))
    return { entries: body as EntryInput[] }
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    if (Array.isArray(record.entries))
      return { entries: record.entries as EntryInput[], import_id: typeof record.import_id === 'string' ? record.import_id : undefined }
    // Treat a bare object as a single entry.
    if ('lexeme' in record)
      return { entries: [record as unknown as EntryInput] }
  }
  return { entries: [] }
}

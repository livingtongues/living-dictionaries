import type { RequestHandler } from './$types'
import type { SuggestionRow } from '$lib/corpus/aggregate-suggestions'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { get_dictionary_suggestions } from '$lib/db/server/v1-suggestions'
import { load_v1_dictionary_context } from '$lib/db/server/v1-route-context'
import { json } from '@sveltejs/kit'

/** Occurrence lists are capped per row (totals stay exact) to keep responses
 *  bounded on corpora where one function word appears thousands of times. */
const MAX_OCCURRENCES_PER_ROW = 20

export interface V1SuggestionsGetResponseBody {
  /** Word forms with no entry link at all, frequency-sorted. */
  unmatched: SuggestionRow[]
  /** Forms the auto-matcher found multiple candidate entries for. */
  ambiguous: SuggestionRow[]
  /** Occurrence ignores + the dictionary-level `ignored_forms` list (`everywhere: true`). */
  ignored: SuggestionRow[]
}

/**
 * GET /api/v1/dictionaries/[id]/suggestions — the suggestions queue: unmatched
 * / ambiguous / ignored word forms aggregated across all tokenized sentences
 * (same pure aggregation the queue UI runs client-side).
 */
export const GET: RequestHandler = async (event) => {
  const { dictionary } = await load_v1_dictionary_context({ event, access: 'read' })
  const facets = get_dictionary_suggestions(get_dictionary_db(dictionary.id))
  return json({
    unmatched: facets.unmatched.map(cap_occurrences),
    ambiguous: facets.ambiguous.map(cap_occurrences),
    ignored: facets.ignored.map(cap_occurrences),
  } satisfies V1SuggestionsGetResponseBody)
}

function cap_occurrences(row: SuggestionRow): SuggestionRow {
  if (row.occurrences.length <= MAX_OCCURRENCES_PER_ROW)
    return row
  return { ...row, occurrences: row.occurrences.slice(0, MAX_OCCURRENCES_PER_ROW) }
}

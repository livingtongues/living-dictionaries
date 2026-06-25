/**
 * Stable analytics-event vocabulary for `track({ event })` (`$lib/debug/remote-log`).
 *
 * These names are the grouping keys the nightly `log_daily_metrics` rollup
 * aggregates on (`event:<name>`) — free-form strings don't aggregate, so add new
 * events HERE and reuse the constant at the call site. Each `track()` stores the
 * name as the `client_logs.message` of an `info` row, with the event's
 * structured fields under `context`.
 */

/** A user ran an entry search (debounced to the settled query). props: query, query_len, result_count, zero_results. */
export const SEARCH_PERFORMED = 'search_performed'

/** A dictionary was opened (entries list). props: dictionary_id. */
export const DICTIONARY_OPENED = 'dictionary_opened'

/** A specific entry detail view was opened. props: dictionary_id, entry_id. */
export const ENTRY_OPENED = 'entry_opened'

/** Audio for an entry/sentence was played. props: dictionary_id, audio_id. */
export const AUDIO_PLAYED = 'audio_played'

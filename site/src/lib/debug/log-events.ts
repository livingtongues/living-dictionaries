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

/** A new entry was created via the editing UI. props: dictionary_id, entry_id. */
export const ENTRY_CREATED = 'entry_created'

/** An entry was deleted via the editing UI. props: dictionary_id, entry_id. */
export const ENTRY_DELETED = 'entry_deleted'

/** An editor starred an entry onto the dictionary-home featured strip. props: dictionary_id, entry_id. */
export const ENTRY_FEATURED = 'entry_featured'

/** An editor removed an entry from the featured strip. props: dictionary_id, entry_id. */
export const ENTRY_UNFEATURED = 'entry_unfeatured'

/**
 * Every analytics event the app is SUPPOSED to emit. The dashboard's
 * self-instrumentation panel compares this list against what's actually been
 * seen in `client_logs`, flagging any "defined but never emitted" event — the
 * exact blind spot the 2026-06-25 log review caught (all four defined, none
 * wired up). Add a new event constant above AND to this list.
 */
export const ALL_TRACKED_EVENTS = [
  SEARCH_PERFORMED,
  DICTIONARY_OPENED,
  ENTRY_OPENED,
  AUDIO_PLAYED,
  ENTRY_CREATED,
  ENTRY_DELETED,
  ENTRY_FEATURED,
  ENTRY_UNFEATURED,
] as const

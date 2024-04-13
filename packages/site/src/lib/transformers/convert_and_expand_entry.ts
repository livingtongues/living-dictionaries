import type { ActualDatabaseEntry, ExpandedEntry, GoalDatabaseEntry } from '@living-dictionaries/types'
import { firebaseConfig } from 'sveltefirets'
import { convert_entry_to_current_shape } from './convert_entry_to_current_shape'
import { expand_entry } from './expand_entry'
import type { TranslateFunction } from '$lib/i18n/types'

/**
 * using ..entry can be removed if:
 * 1) entire front-end uses expanded format - DONE
 * 2) all fields are expanded or at least copied into expanded entry (including deprecated fields in sounds files like previousFileName) until completely refactored out of database
 * should still retain abbreviated translated fields (ps, sdn) as they lose their database value when expanded (because of translation into current language)
 */
export function convert_and_expand_entry(entry: ActualDatabaseEntry, t: TranslateFunction): GoalDatabaseEntry & ExpandedEntry {
  const goal_database_entry = convert_entry_to_current_shape(entry)
  const expanded_entry = expand_entry(goal_database_entry, t, firebaseConfig.storageBucket)
  // @ts-expect-error - TODO: can we remove ...entry?
  return {
    ...entry,
    ...goal_database_entry,
    ...expanded_entry,
  }
}

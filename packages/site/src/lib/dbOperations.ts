import { updateSense } from '$lib/supabase/change/sense';
import { updateFirestoreEntry } from '$lib/helpers/entry/update';

export const dbOperations = {
  updateFirestoreEntry,
  updateSense,
}

export type DbOperations = typeof dbOperations

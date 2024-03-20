import { update_sense } from '$lib/supabase/change/sense';
import { update_sentence } from '$lib/supabase/change/sentence';
import { updateFirestoreEntry } from '$lib/helpers/entry/update';
import { deleteImage } from '$lib/helpers/delete';

export const dbOperations = {
  deleteImage,
  updateFirestoreEntry,
  update_sense,
  update_sentence,
}

export type DbOperations = typeof dbOperations

export const ENTRY_UPDATED_LOAD_TRIGGER = 'entry:updated'

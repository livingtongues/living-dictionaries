import { update_sense } from '$lib/supabase/change/sense';
import { update_sentence } from '$lib/supabase/change/sentence';
import { updateFirestoreEntry } from '$lib/helpers/entry/update';
import { deleteEntry, deleteImage, deleteVideo } from '$lib/helpers/delete';
import { addNewEntry } from './helpers/entry/new';

export const dbOperations = {
  addNewEntry,
  deleteEntry,
  deleteImage,
  deleteVideo,
  updateFirestoreEntry,
  update_sense,
  update_sentence,
}

export type DbOperations = typeof dbOperations

export const ENTRY_UPDATED_LOAD_TRIGGER = 'entry:updated'

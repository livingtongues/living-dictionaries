import { addNewEntry } from './helpers/entry/new'
import { update_sense } from '$lib/supabase/change/sense'
import { update_sentence } from '$lib/supabase/change/sentence'
import { updateEntry, updateEntryOnline } from '$lib/helpers/entry/update'
import { deleteEntry, deleteImage, deleteVideo } from '$lib/helpers/delete'

export const dbOperations = {
  addNewEntry,
  deleteEntry,
  deleteImage,
  deleteVideo,
  updateEntry,
  updateEntryOnline,
  update_sense,
  update_sentence,
}

export type DbOperations = typeof dbOperations

export const ENTRY_UPDATED_LOAD_TRIGGER = 'entry:updated'

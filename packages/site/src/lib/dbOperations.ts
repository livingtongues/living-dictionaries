import { addNewEntry, add_speaker } from './helpers/entry/new'
import { update_sense } from '$lib/supabase/change/sense'
import { update_sentence } from '$lib/supabase/change/sentence'
import { updateEntry, updateEntryOnline } from '$lib/helpers/entry/update'
import { addAudio, addImage, addVideo, deleteAudio, deleteEntry, deleteImage, deleteVideo } from '$lib/helpers/media'

export const dbOperations = {
  addNewEntry,
  add_speaker,

  addVideo,
  addAudio,
  deleteVideo,
  addImage,
  deleteImage,
  deleteAudio,
  deleteEntry,

  updateEntry,
  updateEntryOnline,
  update_sense,
  update_sentence,
}

export type DbOperations = typeof dbOperations

export const ENTRY_UPDATED_LOAD_TRIGGER = 'entry:updated'

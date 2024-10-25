import { assign_dialect, assign_speaker, insert_dialect, insert_entry, insert_photo, insert_sense, insert_sentence, insert_video, update_entry, update_photo, update_sense, update_sentence, update_video, upsert_audio, upsert_speaker } from '$lib/supabase/operations'
import { addAudio, addImage, uploadVideo } from '$lib/helpers/media'

export const dbOperations = {
  insert_entry,
  update_entry,

  insert_sense,
  update_sense,

  insert_sentence,
  update_sentence,

  upsert_audio,

  upsert_speaker,
  assign_speaker,

  insert_dialect,
  assign_dialect,

  insert_photo,
  update_photo,

  insert_video,
  update_video,

  addAudio,
  addImage,
  uploadVideo,
}

export type DbOperations = typeof dbOperations

export const ENTRY_UPDATED_LOAD_TRIGGER = 'entry:updated'

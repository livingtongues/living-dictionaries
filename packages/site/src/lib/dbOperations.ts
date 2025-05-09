import { assign_dialect, assign_speaker, assign_tag, insert_audio, insert_dialect, insert_entry, insert_photo, insert_sense, insert_sentence, insert_speaker, insert_tag, insert_video, update_audio, update_entry, update_photo, update_sense, update_sentence, update_video } from '$lib/supabase/operations'
import { addAudio, addImage, uploadVideo } from '$lib/helpers/media'

export const dbOperations = {
  insert_entry,
  update_entry,

  insert_sense,
  update_sense,

  insert_sentence,
  update_sentence,

  insert_audio,
  update_audio,

  insert_speaker,
  assign_speaker,

  insert_tag,
  assign_tag,

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

export const DICTIONARY_UPDATED_LOAD_TRIGGER = 'dictionary:updated'

import { assign_dialect, assign_speaker, assign_tag, delete_audio, delete_entry, delete_photo, delete_relationship, delete_sense, delete_sentence, delete_video, insert_audio, insert_dialect, insert_entry, insert_photo, insert_relationship, insert_sense, insert_sentence, insert_source, insert_speaker, insert_tag, insert_video, remove_source_and_delete, update_audio, update_photo, update_sentence, update_source, update_video } from '$lib/db/dict-client/operations'
import { addAudio, addImage, uploadVideo } from '$lib/helpers/media'

export const db_operations = {
  insert_entry,
  delete_entry,

  insert_sense,
  delete_sense,

  insert_sentence,
  update_sentence,
  delete_sentence,

  insert_audio,
  update_audio,
  delete_audio,

  insert_speaker,
  assign_speaker,

  insert_tag,
  assign_tag,

  insert_dialect,
  assign_dialect,

  insert_relationship,
  delete_relationship,

  insert_source,
  update_source,
  remove_source_and_delete,

  insert_photo,
  update_photo,
  delete_photo,

  insert_video,
  update_video,
  delete_video,

  addAudio,
  addImage,
  uploadVideo,
}

export type DbOperations = typeof db_operations

export const DICTIONARY_UPDATED_LOAD_TRIGGER = 'dictionary:updated'

import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'

const log_args = (args: any) => console.info({ args }) as unknown as Promise<any>

export const log_writes: GuardedWrites = {
  insert_entry: log_args,
  delete_entry: log_args,
  insert_sense: log_args,
  delete_sense: log_args,
  insert_sentence: log_args,
  update_sentence: log_args,
  delete_sentence: log_args,
  insert_audio: log_args,
  update_audio: log_args,
  delete_audio: log_args,
  insert_speaker: log_args,
  assign_speaker: log_args,
  insert_tag: log_args,
  assign_tag: log_args,
  insert_dialect: log_args,
  assign_dialect: log_args,
  insert_relationship: log_args,
  delete_relationship: log_args,
  insert_source: log_args,
  update_source: log_args,
  remove_source_and_delete: log_args,
  insert_photo: log_args,
  update_photo: log_args,
  delete_photo: log_args,
  insert_video: log_args,
  update_video: log_args,
  delete_video: log_args,
}

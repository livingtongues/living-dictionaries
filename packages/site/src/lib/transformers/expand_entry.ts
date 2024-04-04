import type { DatabaseSense, ExpandedAudio, ExpandedEntry, ExpandedPhoto, ExpandedSense, ExpandedVideo, GoalDatabaseAudio, GoalDatabaseEntry, GoalDatabasePhoto, GoalDatabaseVideo } from '@living-dictionaries/types'
import { firebaseConfig } from 'sveltefirets'
import { convert_timestamp_to_date_object } from './timestamp_to_date'
import { translate_part_of_speech_to_current_language, translate_semantic_domain_keys_to_current_language } from './translate_keys_to_current_language'
import type { TranslateFunction } from '$lib/i18n/types'

export function expand_entry(database_entry: GoalDatabaseEntry, t: TranslateFunction): ExpandedEntry {
  const expanded_entry: ExpandedEntry = {
    id: database_entry.id,
    lexeme: database_entry.lx,
    local_orthography_1: database_entry.lo1,
    local_orthography_2: database_entry.lo2,
    local_orthography_3: database_entry.lo3,
    local_orthography_4: database_entry.lo4,
    local_orthography_5: database_entry.lo5,
    phonetic: database_entry.ph,
    senses: database_entry.sn?.map(sense => expand_sense(sense, t)) || [{}],
    interlinearization: database_entry.in,
    morphology: database_entry.mr,
    plural_form: database_entry.pl,
    variant: database_entry.va,
    dialects: database_entry.di,
    notes: database_entry.nt,
    sources: database_entry.sr,
    sound_files: database_entry.sfs?.map(expand_audio),
    elicitation_id: database_entry.ei,
    deletedAt: database_entry.deletedAt,
    scientific_names: database_entry.scn,
    coordinates: database_entry.co,
  }
  Object.keys(expanded_entry).forEach(key => expanded_entry[key] === undefined && delete expanded_entry[key])
  return expanded_entry
}

function expand_sense(sense: DatabaseSense, t: TranslateFunction): ExpandedSense {
  const expanded_sense: ExpandedSense = {
    glosses: sense.gl,
    parts_of_speech_keys: sense.ps,
    translated_parts_of_speech: sense.ps?.map(part => translate_part_of_speech_to_current_language(part, t)),
    ld_semantic_domains_keys: sense.sdn,
    translated_ld_semantic_domains: sense.sdn?.map(domain => translate_semantic_domain_keys_to_current_language(domain, t)),
    write_in_semantic_domains: sense.sd,
    example_sentences: sense.xs,
    photo_files: sense.pfs?.map(expand_photo),
    video_files: sense.vfs?.map(expand_video),
    noun_class: sense.nc,
    definition_english: sense.de,
  }
  Object.keys(expanded_sense).forEach(key => expanded_sense[key] === undefined && delete expanded_sense[key])
  return expanded_sense
}

function expand_photo(pf: GoalDatabasePhoto): ExpandedPhoto {
  const expanded_photo: ExpandedPhoto = {
    fb_storage_path: pf.path,
    storage_url: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(pf.path)}?alt=media`,
    specifiable_image_url: pf.gcs,
    uid_added_by: pf.ab,
    timestamp: convert_timestamp_to_date_object(pf.ts),
    source: pf.sc,
    photographer_credit: pf.cr,
  }
  Object.keys(expanded_photo).forEach(key => expanded_photo[key] === undefined && delete expanded_photo[key])
  return expanded_photo
}

export function expand_video(vf: GoalDatabaseVideo): ExpandedVideo {
  const expanded_video: ExpandedVideo = {
    fb_storage_path: vf.path,
    storage_url: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(vf.path)}?alt=media`,
    uid_added_by: vf.ab,
    timestamp: convert_timestamp_to_date_object(vf.ts),
    speaker_ids: vf.sp,
    source: vf.sc,
    youtubeId: vf.youtubeId,
    vimeoId: vf.vimeoId,
    start_at_seconds: vf.startAt,
  }
  Object.keys(expanded_video).forEach(key => expanded_video[key] === undefined && delete expanded_video[key])
  return expanded_video
}

function expand_audio(sf: GoalDatabaseAudio): ExpandedAudio {
  const expanded_audio: ExpandedAudio = {
    fb_storage_path: sf.path,
    storage_url: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(sf.path)}?alt=media`,
    uid_added_by: sf.ab,
    timestamp: convert_timestamp_to_date_object(sf.ts),
    speaker_ids: sf.sp,
    source: sf.sc,
    speakerName: sf.speakerName,
  }
  Object.keys(expanded_audio).forEach(key => expanded_audio[key] === undefined && delete expanded_audio[key])
  return expanded_audio
}

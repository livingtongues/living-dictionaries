import type { DatabaseSense, ExpandedEntry, ExpandedSense, GoalDatabaseEntry } from '@living-dictionaries/types';
import type { ExpandedAudio, GoalDatabaseAudio } from '@living-dictionaries/types/audio.interface';
import type { ExpandedPhoto, GoalDatabasePhoto } from '@living-dictionaries/types/photo.interface';
import type { ExpandedVideo, GoalDatabaseVideo } from '@living-dictionaries/types/video.interface';
import { convert_timestamp_to_date_object } from './timestamp_to_date';
import { translate_part_of_speech_to_current_language, translate_semantic_domain_keys_to_current_language } from './translate_keys_to_current_language';

export function expand_entry(database_entry: GoalDatabaseEntry): ExpandedEntry {
  return {
    id: database_entry.id,
    lexeme: database_entry.lx,
    local_orthography_1: database_entry.lo1,
    local_orthography_2: database_entry.lo2,
    local_orthography_3: database_entry.lo3,
    local_orthography_4: database_entry.lo4,
    local_orthography_5: database_entry.lo5,
    phonetic: database_entry.ph,
    senses: database_entry.sn?.map(expand_sense) || [],
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
}

function expand_sense(sense: DatabaseSense): ExpandedSense {
  return {
    glosses: sense.gl,
    parts_of_speech_keys: sense.ps,
    translated_parts_of_speech: sense.ps?.map(translate_part_of_speech_to_current_language),
    ld_semantic_domains_keys: sense.sdn,
    translated_ld_semantic_domains: sense.sdn?.map(translate_semantic_domain_keys_to_current_language),
    write_in_semantic_domains: sense.sd,
    example_sentences: sense.xs,
    photo_files: sense.pfs?.map(expand_photo),
    video_files: sense.vfs?.map(expand_video),
    noun_class: sense.nc,
    definition_english: sense.de,
  };
}

function expand_photo(pf: GoalDatabasePhoto): ExpandedPhoto {
  return {
    fb_storage_path: pf.path,
    specifiable_image_url: pf.gcs,
    uid_added_by: pf.ab,
    timestamp: convert_timestamp_to_date_object(pf.ts),
    source: pf.sc,
    photographer_credit: pf.cr,
  };
}

export function expand_video(vf: GoalDatabaseVideo): ExpandedVideo {
  return {
    fb_storage_path: vf.path,
    uid_added_by: vf.ab,
    timestamp: convert_timestamp_to_date_object(vf.ts),
    speaker_ids: vf.sp,
    source: vf.sc,
    youtubeId: vf.youtubeId,
    vimeoId: vf.vimeoId,
    start_at_seconds: vf.startAt,
  };
}

function expand_audio(sf: GoalDatabaseAudio): ExpandedAudio {
  return {
    fb_storage_path: sf.path,
    uid_added_by: sf.ab,
    timestamp: convert_timestamp_to_date_object(sf.ts),
    speaker_ids: sf.sp,
    source: sf.sc,
    speakerName: sf.speakerName,
  }
}


import type { Tables } from './combined.types'

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
}

export type EntryView = Tables<'entries_view'>
export type PartialEntryView = DeepPartial<Tables<'entries_view'>>

export type SenseWithSentences = Pick<Tables<'senses'>, 'id' | 'glosses' | 'parts_of_speech' | 'semantic_domains' | 'write_in_semantic_domains' | 'noun_class' | 'definition' | 'plural_form' | 'variant'> & {
  sentence_ids: string[]
  photo_ids: string[]
  video_ids: string[]
}

export type AudioWithSpeakerIds = Tables<'audio'> & { speaker_ids: string[] }

export type EntryMainFields = Pick<Tables<'entries'>, 'coordinates' | 'elicitation_id' | 'lexeme' | 'interlinearization' | 'morphology' | 'notes' | 'phonetic' | 'scientific_names' | 'sources' | 'unsupported_fields'>

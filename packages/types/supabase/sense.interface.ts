import type { Tables } from './combined.types'

export type SenseWithSentences = (
  Pick<Tables<'senses'>, 'id' | 'glosses' | 'parts_of_speech' | 'semantic_domains' | 'write_in_semantic_domains' | 'noun_class' | 'definition' | 'plural_form' | 'variant'>
  & {
    sentence_ids: string[]
    photo_ids: string[]
    video_ids: string[]
  }
)

export type AudioWithSpeakerIds = Tables<'audio'> & { speaker_ids: string[] }

export type EntryMainFields = Pick<Tables<'entries'>, 'coordinates' | 'elicitation_id' | 'lexeme' | 'interlinearization' | 'morphology' | 'notes' | 'phonetic' | 'scientific_names' | 'sources' | 'unsupported_fields'>

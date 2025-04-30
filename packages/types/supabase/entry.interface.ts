import type { Tables } from './combined.types'

export type AudioWithSpeakerIds = Tables<'audio'> & { speaker_ids: string[] }

export type EntryMainFields = Pick<Tables<'entries'>, 'coordinates' | 'elicitation_id' | 'lexeme' | 'interlinearization' | 'morphology' | 'notes' | 'phonetic' | 'scientific_names' | 'sources' | 'unsupported_fields'>

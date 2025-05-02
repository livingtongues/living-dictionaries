import type { Tables } from './combined.types'

type EntryDataSense = Pick<Tables<'senses'>, 'id' | 'updated_at' | 'definition' | 'glosses' | 'noun_class' | 'parts_of_speech' | 'plural_form' | 'semantic_domains' | 'variant' | 'write_in_semantic_domains'> & {
  sentences?: Pick<Tables<'sentences'>, 'id' | 'updated_at' | 'text' | 'translation'>[]
  photos?: Pick<Tables<'photos'>, 'id' | 'updated_at' | 'photographer' | 'storage_path' | 'serving_url' | 'source'>[]
  videos?: Pick<Tables<'videos'>, 'id' | 'updated_at' | 'hosted_elsewhere' | 'source' | 'storage_path' | 'videographer'>[]
}

type EntryDataAudio = Pick<Tables<'audio'>, 'id' | 'updated_at' | 'source' | 'storage_path'> & {
  speakers?: Pick<Tables<'speakers'>, 'id' | 'updated_at' | 'birthplace' | 'decade' | 'gender' | 'name'>[]
}

export interface EntryData {
  id: string
  main: Pick<Tables<'entries'>, 'coordinates' | 'elicitation_id' | 'lexeme' | 'interlinearization' | 'morphology' | 'notes' | 'phonetic' | 'scientific_names' | 'sources'>
  senses: EntryDataSense[]
  audios?: EntryDataAudio[]
  dialects?: Pick<Tables<'dialects'>, 'id' | 'updated_at' | 'name'>[]
  tags?: Pick<Tables<'tags'>, 'id' | 'updated_at' | 'name'>[]
  updated_at: string
  deleted?: string
}

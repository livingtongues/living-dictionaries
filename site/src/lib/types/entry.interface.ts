import type { Tables } from './db'

type EntryDataSense = Pick<Tables<'senses'>, 'id' | 'updated_at' | 'created_at' | 'definition' | 'glosses' | 'noun_class' | 'parts_of_speech' | 'plural_form' | 'semantic_domains' | 'sources' | 'variant' | 'write_in_semantic_domains'> & {
  sentences?: Pick<Tables<'sentences'>, 'id' | 'updated_at' | 'text' | 'translation' | 'text_id'>[]
  photos?: Pick<Tables<'photos'>, 'id' | 'updated_at' | 'photographer' | 'storage_path' | 'serving_url' | 'source' | 'latitude' | 'longitude' | 'taken_at'>[]
  videos?: Pick<Tables<'videos'>, 'id' | 'updated_at' | 'hosted_elsewhere' | 'hosted_metadata' | 'source' | 'storage_path' | 'videographer'>[]
}

type EntryDataAudio = Pick<Tables<'audio'>, 'id' | 'updated_at' | 'source' | 'storage_path'> & {
  speakers?: Pick<Tables<'speakers'>, 'id' | 'updated_at' | 'birthplace' | 'decade' | 'gender' | 'name'>[]
}

export interface EntryData {
  id: string
  main: Pick<Tables<'entries'>, 'citations' | 'coordinates' | 'elicitation_id' | 'homograph' | 'lexeme' | 'interlinearization' | 'linguistic_history' | 'morphology' | 'notes' | 'phonetic' | 'scientific_names' | 'sources'>
  senses: EntryDataSense[]
  audios?: EntryDataAudio[]
  dialects?: Pick<Tables<'dialects'>, 'id' | 'updated_at' | 'name' | 'coordinates'>[]
  tags?: Pick<Tables<'tags'>, 'id' | 'updated_at' | 'name' | 'private'>[]
  updated_at: string
  deleted?: string
}

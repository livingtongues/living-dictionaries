/** Slim public-dictionary projection powering the homepage search + map dots. */
export interface MapDict {
  id: string
  /** URL slug — every public dictionary has one; links are `/${url}`. */
  url: string
  name: string
  lat: number | null
  lng: number | null
  entry_count: number
  gloss_languages: string[]
  location: string | null
  alternate_names: string[]
}

/** Example-sentence snapshot for the card modal (MultiStrings keyed by locale). */
export interface FeaturedExampleSentence {
  text: Record<string, string> | null
  translation: Record<string, string> | null
}

/** A curated word card (approved `featured_entries` row) as baked into the homepage bundle. */
export interface FeaturedCard {
  id: string
  dict_id: string
  dict_url: string
  dict_name: string
  dict_location?: string | null
  entry_id: string
  lexeme: string
  gloss: string | null
  gloss_language: string | null
  photo_serving_url: string
  audio_storage_path: string
  lng: number | null
  lat: number | null
  // Modal snapshot fields (nullable — pre-pivot rows lack them until backfill)
  phonetic?: string | null
  glosses?: Record<string, string> | null
  speaker_name?: string | null
  example_sentence?: FeaturedExampleSentence | null
}

export interface HomepageStats {
  dictionaries: number
  entries: number
  audio: number
  photos: number
  videos: number
  users: number
}

export interface HomepageBaked {
  generated_at: string
  stats: HomepageStats
  featured_entries: FeaturedCard[]
}

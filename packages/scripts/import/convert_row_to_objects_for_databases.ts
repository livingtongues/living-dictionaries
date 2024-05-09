import type { ActualDatabaseEntry, ContentUpdateRequestBody } from '@living-dictionaries/types'

export function convert_row_to_objects_for_databases({ row, dateStamp, timestamp }: {
  row: Record<string, string> // TODO: type this
  dateStamp?: number
  timestamp?: FirebaseFirestore.FieldValue
}): {
    firebase_entry: ActualDatabaseEntry
    supabase_senses: {
      sense_id: string
      sense: ContentUpdateRequestBody['change']['sense']
    }[]
    supabase_sentences: {
      sentence_id: string
      sense_id: string
      sentence: ContentUpdateRequestBody['change']['sentence']
    }[]
  } {
  return {
    firebase_entry: {},
    supabase_senses: [],
    supabase_sentences: [],
  }
}

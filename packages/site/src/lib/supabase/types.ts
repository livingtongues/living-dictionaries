export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      entry_updates: {
        Row: {
          column: string
          dictionary_id: string
          entry_id: string
          id: string
          new_value: string
          old_value: string | null
          row: string
          table: Database['public']['Enums']['entry_tables']
          timestamp: string
          user_id: string
        }
        Insert: {
          column: string
          dictionary_id: string
          entry_id: string
          id: string
          new_value: string
          old_value?: string | null
          row: string
          table: Database['public']['Enums']['entry_tables']
          timestamp?: string
          user_id: string
        }
        Update: {
          column?: string
          dictionary_id?: string
          entry_id?: string
          id?: string
          new_value?: string
          old_value?: string | null
          row?: string
          table?: Database['public']['Enums']['entry_tables']
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      senses: {
        Row: {
          created_at: string
          created_by: string
          definition_english_deprecated: string | null
          deleted: string | null
          entry_id: string
          glosses: Json | null
          id: string
          noun_class: string | null
          parts_of_speech: Json | null
          semantic_domains: Json | null
          updated_at: string
          updated_by: string
          write_in_semantic_domains: Json | null
        }
        Insert: {
          created_at?: string
          created_by: string
          definition_english_deprecated?: string | null
          deleted?: string | null
          entry_id: string
          glosses?: Json | null
          id: string
          noun_class?: string | null
          parts_of_speech?: Json | null
          semantic_domains?: Json | null
          updated_at?: string
          updated_by: string
          write_in_semantic_domains?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string
          definition_english_deprecated?: string | null
          deleted?: string | null
          entry_id?: string
          glosses?: Json | null
          id?: string
          noun_class?: string | null
          parts_of_speech?: Json | null
          semantic_domains?: Json | null
          updated_at?: string
          updated_by?: string
          write_in_semantic_domains?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      entry_tables:
        | 'entry'
        | 'senses'
        | 'audio'
        | 'videos'
        | 'photos'
        | 'speakers'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}


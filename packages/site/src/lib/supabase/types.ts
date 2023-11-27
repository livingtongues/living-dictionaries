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
          column: Database['public']['Enums']['entry_columns']
          dictionary_id: string
          entry_id: string
          id: string
          new_value: string | null
          old_value: string | null
          row: string
          table: Database['public']['Enums']['entry_tables']
          timestamp: string
          user_id: string
        }
        Insert: {
          column: Database['public']['Enums']['entry_columns']
          dictionary_id: string
          entry_id: string
          id: string
          new_value?: string | null
          old_value?: string | null
          row: string
          table: Database['public']['Enums']['entry_tables']
          timestamp?: string
          user_id: string
        }
        Update: {
          column?: Database['public']['Enums']['entry_columns']
          dictionary_id?: string
          entry_id?: string
          id?: string
          new_value?: string | null
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
          parts_of_speech: string[] | null
          semantic_domains: string[] | null
          updated_at: string
          updated_by: string
          write_in_semantic_domains: string[] | null
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
          parts_of_speech?: string[] | null
          semantic_domains?: string[] | null
          updated_at?: string
          updated_by: string
          write_in_semantic_domains?: string[] | null
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
          parts_of_speech?: string[] | null
          semantic_domains?: string[] | null
          updated_at?: string
          updated_by?: string
          write_in_semantic_domains?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      entries_view: {
        Row: {
          id: string | null
          senses: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      entry_columns:
        | 'deleted'
        | 'glosses'
        | 'parts_of_speech'
        | 'semantic_domains'
        | 'write_in_semantic_domains'
        | 'noun_class'
        | 'definition_english_deprecated'
      entry_tables: 'senses'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}


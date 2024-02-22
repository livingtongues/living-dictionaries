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
      sentence_updates: {
        Row: {
          column: Database['public']['Enums']['sentence_columns'] | null
          dictionary_id: string
          sentence_id: string
          id: string
          new_value: string | null
          old_value: string | null
          sense_id: string
          table: Database['public']['Enums']['sentence_tables']
          timestamp: string
          user_id: string
        }
        Insert: {
          column?:
            | Database['public']['Enums']['sentence_columns']
            | null
          dictionary_id: string
          sentence_id: string
          id: string
          new_value?: string | null
          old_value?: string | null
          sense_id: string
          table: Database['public']['Enums']['sentence_tables']
          timestamp?: string
          user_id: string
        }
        Update: {
          column?:
            | Database['public']['Enums']['sentence_columns']
            | null
          dictionary_id?: string
          sentence_id?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          sense_id?: string
          table?: Database['public']['Enums']['sentence_tables']
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sentence_updates_sentence_id_fkey'
            columns: ['sentence_id']
            isOneToOne: false
            referencedRelation: 'sentences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentence_updates_sense_id_fkey'
            columns: ['sense_id']
            isOneToOne: false
            referencedRelation: 'senses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentence_updates_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      sentences: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          id: string
          text: string
          translation: Json | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          id: string
          text: string
          translation?: Json | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          id?: string
          text?: string
          translation?: Json | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sentences_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentences_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      senses: {
        Row: {
          created_at: string
          created_by: string
          definition: Json | null
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
          definition?: Json | null
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
          definition?: Json | null
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
      senses_in_sentences: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          sentence_id: string
          sense_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          sentence_id: string
          sense_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          sentence_id?: string
          sense_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'senses_in_sentences_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'senses_in_sentences_sentence_id_fkey'
            columns: ['sentence_id']
            isOneToOne: false
            referencedRelation: 'sentences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'senses_in_sentences_sense_id_fkey'
            columns: ['sense_id']
            isOneToOne: false
            referencedRelation: 'senses'
            referencedColumns: ['id']
          }
        ]
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
        | 'definition'
      entry_tables: 'senses'
      sentence_columns: 'deleted' | 'text' | 'translation'
      sentence_tables:
        | 'sentences'
        | 'senses_in_sentences'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
      Database['public']['Views'])
  ? (Database['public']['Tables'] &
      Database['public']['Views'])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database['public']['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof Database['public']['Enums']
  ? Database['public']['Enums'][PublicEnumNameOrOptions]
  : never


import type { HostedVideo, UnsupportedFields } from '@living-dictionaries/types'

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
      audio: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          entry_id: string | null
          id: string
          sentence_id: string | null
          source: string | null
          storage_path: string
          text_id: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          entry_id?: string | null
          id?: string
          sentence_id?: string | null
          source?: string | null
          storage_path: string
          text_id?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          entry_id?: string | null
          id?: string
          sentence_id?: string | null
          source?: string | null
          storage_path?: string
          text_id?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audio_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audio_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audio_entry_id_fkey'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audio_sentence_id_fkey'
            columns: ['sentence_id']
            isOneToOne: false
            referencedRelation: 'sentences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audio_text_id_fkey'
            columns: ['text_id']
            isOneToOne: false
            referencedRelation: 'texts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audio_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audio_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      audio_speakers: {
        Row: {
          audio_id: string
          created_at: string
          created_by: string
          deleted: string | null
          speaker_id: string
        }
        Insert: {
          audio_id: string
          created_at?: string
          created_by: string
          deleted?: string | null
          speaker_id: string
        }
        Update: {
          audio_id?: string
          created_at?: string
          created_by?: string
          deleted?: string | null
          speaker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audio_speakers_audio_id_fkey'
            columns: ['audio_id']
            isOneToOne: false
            referencedRelation: 'audio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audio_speakers_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audio_speakers_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audio_speakers_speaker_id_fkey'
            columns: ['speaker_id']
            isOneToOne: false
            referencedRelation: 'speakers'
            referencedColumns: ['id']
          },
        ]
      }
      content_updates: {
        Row: {
          audio_id: string | null
          change: Json
          dictionary_id: string
          entry_id: string | null
          id: string
          import_id: string | null
          photo_id: string | null
          sense_id: string | null
          sentence_id: string | null
          speaker_id: string | null
          table: Database['public']['Enums']['content_tables']
          text_id: string | null
          timestamp: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          audio_id?: string | null
          change: Json
          dictionary_id: string
          entry_id?: string | null
          id: string
          import_id?: string | null
          photo_id?: string | null
          sense_id?: string | null
          sentence_id?: string | null
          speaker_id?: string | null
          table: Database['public']['Enums']['content_tables']
          text_id?: string | null
          timestamp?: string
          user_id?: string
          video_id?: string | null
        }
        Update: {
          audio_id?: string | null
          change?: Json
          dictionary_id?: string
          entry_id?: string | null
          id?: string
          import_id?: string | null
          photo_id?: string | null
          sense_id?: string | null
          sentence_id?: string | null
          speaker_id?: string | null
          table?: Database['public']['Enums']['content_tables']
          text_id?: string | null
          timestamp?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'content_updates_audio_id_fkey'
            columns: ['audio_id']
            isOneToOne: false
            referencedRelation: 'audio'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_dictionary_id_fkey'
            columns: ['dictionary_id']
            isOneToOne: false
            referencedRelation: 'dictionaries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_entry_id_fkey'
            columns: ['entry_id']
            isOneToOne: false
            referencedRelation: 'entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_photo_id_fkey'
            columns: ['photo_id']
            isOneToOne: false
            referencedRelation: 'photos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_sense_id_fkey'
            columns: ['sense_id']
            isOneToOne: false
            referencedRelation: 'senses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_sentence_id_fkey'
            columns: ['sentence_id']
            isOneToOne: false
            referencedRelation: 'sentences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_speaker_id_fkey'
            columns: ['speaker_id']
            isOneToOne: false
            referencedRelation: 'speakers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_text_id_fkey'
            columns: ['text_id']
            isOneToOne: false
            referencedRelation: 'texts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_updates_video_id_fkey'
            columns: ['video_id']
            isOneToOne: false
            referencedRelation: 'videos'
            referencedColumns: ['id']
          },
        ]
      }
      dictionaries: {
        Row: {
          alternate_names: string[] | null
          author_connection: string | null
          community_permission: Database['public']['Enums']['certainty'] | null
          con_language_description: string | null
          coordinates: Json | null
          copyright: string | null
          created_at: string
          created_by: string
          deleted: string | null
          featured_image: Json | null
          gloss_languages: string[] | null
          glottocode: string | null
          hide_living_tongues_logo: boolean | null
          id: string
          iso_639_3: string | null
          language_used_by_community: boolean | null
          location: string | null
          metadata: Json | null
          name: string
          orthographies: Json[] | null
          print_access: boolean | null
          public: boolean
          updated_at: string
          updated_by: string
        }
        Insert: {
          alternate_names?: string[] | null
          author_connection?: string | null
          community_permission?: Database['public']['Enums']['certainty'] | null
          con_language_description?: string | null
          coordinates?: Json | null
          copyright?: string | null
          created_at?: string
          created_by: string
          deleted?: string | null
          featured_image?: Json | null
          gloss_languages?: string[] | null
          glottocode?: string | null
          hide_living_tongues_logo?: boolean | null
          id: string
          iso_639_3?: string | null
          language_used_by_community?: boolean | null
          location?: string | null
          metadata?: Json | null
          name: string
          orthographies?: Json[] | null
          print_access?: boolean | null
          public?: boolean
          updated_at?: string
          updated_by: string
        }
        Update: {
          alternate_names?: string[] | null
          author_connection?: string | null
          community_permission?: Database['public']['Enums']['certainty'] | null
          con_language_description?: string | null
          coordinates?: Json | null
          copyright?: string | null
          created_at?: string
          created_by?: string
          deleted?: string | null
          featured_image?: Json | null
          gloss_languages?: string[] | null
          glottocode?: string | null
          hide_living_tongues_logo?: boolean | null
          id?: string
          iso_639_3?: string | null
          language_used_by_community?: boolean | null
          location?: string | null
          metadata?: Json | null
          name?: string
          orthographies?: Json[] | null
          print_access?: boolean | null
          public?: boolean
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'dictionaries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dictionaries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dictionaries_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'dictionaries_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      entries: {
        Row: {
          coordinates: Json | null
          created_at: string
          created_by: string
          deleted: string | null
          dialects: string[] | null
          dictionary_id: string
          elicitation_id: string | null
          id: string
          interlinearization: string | null
          lexeme: Json
          morphology: string | null
          notes: Json | null
          phonetic: string | null
          plural_form: string | null
          scientific_names: string[] | null
          sources: string[] | null
          unsupported_fields: UnsupportedFields | null
          updated_at: string
          updated_by: string
          variant: string | null
        }
        Insert: {
          coordinates?: Json | null
          created_at?: string
          created_by: string
          deleted?: string | null
          dialects?: string[] | null
          dictionary_id: string
          elicitation_id?: string | null
          id: string
          interlinearization?: string | null
          lexeme: Json
          morphology?: string | null
          notes?: Json | null
          phonetic?: string | null
          plural_form?: string | null
          scientific_names?: string[] | null
          sources?: string[] | null
          unsupported_fields?: UnsupportedFields | null
          updated_at?: string
          updated_by: string
          variant?: string | null
        }
        Update: {
          coordinates?: Json | null
          created_at?: string
          created_by?: string
          deleted?: string | null
          dialects?: string[] | null
          dictionary_id?: string
          elicitation_id?: string | null
          id?: string
          interlinearization?: string | null
          lexeme?: Json
          morphology?: string | null
          notes?: Json | null
          phonetic?: string | null
          plural_form?: string | null
          scientific_names?: string[] | null
          sources?: string[] | null
          unsupported_fields?: UnsupportedFields | null
          updated_at?: string
          updated_by?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'entries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'entries_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'entries_dictionary_id_fkey'
            columns: ['dictionary_id']
            isOneToOne: false
            referencedRelation: 'dictionaries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'entries_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'entries_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
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
      photos: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          id: string
          photographer: string | null
          serving_url: string
          source: string | null
          storage_path: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          id?: string
          photographer?: string | null
          serving_url: string
          source?: string | null
          storage_path: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          id?: string
          photographer?: string | null
          serving_url?: string
          source?: string | null
          storage_path?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'photos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'photos_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      sense_photos: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          photo_id: string
          sense_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          photo_id: string
          sense_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          photo_id?: string
          sense_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sense_photos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sense_photos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sense_photos_photo_id_fkey'
            columns: ['photo_id']
            isOneToOne: false
            referencedRelation: 'photos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sense_photos_sense_id_fkey'
            columns: ['sense_id']
            isOneToOne: false
            referencedRelation: 'senses'
            referencedColumns: ['id']
          },
        ]
      }
      sense_videos: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          sense_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          sense_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          sense_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sense_videos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sense_videos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sense_videos_sense_id_fkey'
            columns: ['sense_id']
            isOneToOne: false
            referencedRelation: 'senses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sense_videos_video_id_fkey'
            columns: ['video_id']
            isOneToOne: false
            referencedRelation: 'videos'
            referencedColumns: ['id']
          },
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
          sense_id: string
          sentence_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          sense_id: string
          sentence_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          sense_id?: string
          sentence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'senses_in_sentences_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'senses_in_sentences_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'senses_in_sentences_sense_id_fkey'
            columns: ['sense_id']
            isOneToOne: false
            referencedRelation: 'senses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'senses_in_sentences_sentence_id_fkey'
            columns: ['sentence_id']
            isOneToOne: false
            referencedRelation: 'sentences'
            referencedColumns: ['id']
          },
        ]
      }
      sentence_photos: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          photo_id: string
          sentence_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          photo_id: string
          sentence_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          photo_id?: string
          sentence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sentence_photos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentence_photos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentence_photos_photo_id_fkey'
            columns: ['photo_id']
            isOneToOne: false
            referencedRelation: 'photos'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentence_photos_sentence_id_fkey'
            columns: ['sentence_id']
            isOneToOne: false
            referencedRelation: 'sentences'
            referencedColumns: ['id']
          },
        ]
      }
      sentence_videos: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          sentence_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          sentence_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          sentence_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sentence_videos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentence_videos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentence_videos_sentence_id_fkey'
            columns: ['sentence_id']
            isOneToOne: false
            referencedRelation: 'sentences'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentence_videos_video_id_fkey'
            columns: ['video_id']
            isOneToOne: false
            referencedRelation: 'videos'
            referencedColumns: ['id']
          },
        ]
      }
      sentences: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          dictionary_id: string
          id: string
          text: Json | null
          text_id: string | null
          translation: Json | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          dictionary_id: string
          id: string
          text?: Json | null
          text_id?: string | null
          translation?: Json | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          dictionary_id?: string
          id?: string
          text?: Json | null
          text_id?: string | null
          translation?: Json | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sentences_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentences_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentences_dictionary_id_fkey'
            columns: ['dictionary_id']
            isOneToOne: false
            referencedRelation: 'dictionaries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentences_text_id_fkey'
            columns: ['text_id']
            isOneToOne: false
            referencedRelation: 'texts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentences_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sentences_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      speakers: {
        Row: {
          birthplace: string | null
          created_at: string
          created_by: string
          decade: number | null
          deleted: string | null
          gender: Database['public']['Enums']['gender'] | null
          id: string
          name: string
          updated_at: string
          updated_by: string
          user_id: string | null
        }
        Insert: {
          birthplace?: string | null
          created_at?: string
          created_by: string
          decade?: number | null
          deleted?: string | null
          gender?: Database['public']['Enums']['gender'] | null
          id?: string
          name: string
          updated_at?: string
          updated_by: string
          user_id?: string | null
        }
        Update: {
          birthplace?: string | null
          created_at?: string
          created_by?: string
          decade?: number | null
          deleted?: string | null
          gender?: Database['public']['Enums']['gender'] | null
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'speakers_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'speakers_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'speakers_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'speakers_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'speakers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'speakers_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      texts: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          dictionary_id: string
          id: string
          sentences: Json
          title: Json
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          dictionary_id: string
          id: string
          sentences: Json
          title: Json
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          dictionary_id?: string
          id?: string
          sentences?: Json
          title?: Json
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'texts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'texts_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'texts_dictionary_id_fkey'
            columns: ['dictionary_id']
            isOneToOne: false
            referencedRelation: 'dictionaries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'texts_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'texts_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      video_speakers: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          speaker_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          speaker_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          speaker_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'video_speakers_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'video_speakers_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'video_speakers_speaker_id_fkey'
            columns: ['speaker_id']
            isOneToOne: false
            referencedRelation: 'speakers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'video_speakers_video_id_fkey'
            columns: ['video_id']
            isOneToOne: false
            referencedRelation: 'videos'
            referencedColumns: ['id']
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          created_by: string
          deleted: string | null
          hosted_elsewhere: HostedVideo | null
          id: string
          source: string | null
          storage_path: string | null
          text_id: string | null
          updated_at: string
          updated_by: string
          videographer: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted?: string | null
          hosted_elsewhere?: HostedVideo | null
          id?: string
          source?: string | null
          storage_path?: string | null
          text_id?: string | null
          updated_at?: string
          updated_by: string
          videographer?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted?: string | null
          hosted_elsewhere?: HostedVideo | null
          id?: string
          source?: string | null
          storage_path?: string | null
          text_id?: string | null
          updated_at?: string
          updated_by?: string
          videographer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'videos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'videos_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'videos_text_id_fkey'
            columns: ['text_id']
            isOneToOne: false
            referencedRelation: 'texts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'videos_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'user_emails'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'videos_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
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
      user_emails: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          last_sign_in_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          last_sign_in_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          last_sign_in_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      certainty: 'yes' | 'no' | 'unknown'
      content_tables:
        | 'entries'
        | 'senses'
        | 'sentences'
        | 'senses_in_sentences'
        | 'texts'
        | 'audio'
        | 'video'
        | 'photo'
        | 'speakers'
        | 'audio_speakers'
        | 'video_speakers'
        | 'sense_videos'
        | 'sentence_videos'
        | 'sense_photos'
        | 'sentence_photos'
      entry_columns:
        | 'deleted'
        | 'glosses'
        | 'parts_of_speech'
        | 'semantic_domains'
        | 'write_in_semantic_domains'
        | 'noun_class'
        | 'definition'
      entry_tables: 'senses'
      gender: 'm' | 'f' | 'o'
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
    : never = never,
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
    : never = never,
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
    : never = never,
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
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof Database['public']['Enums']
    ? Database['public']['Enums'][PublicEnumNameOrOptions]
    : never

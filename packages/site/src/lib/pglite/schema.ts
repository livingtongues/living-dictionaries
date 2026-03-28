import type { Coordinates, DictionaryPhoto, Orthography } from '@living-dictionaries/types'
import type { DictionaryMetadata } from '@living-dictionaries/types/supabase/dictionary.types'
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const migrations = pgTable('migrations', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  run_on: timestamp({ withTimezone: true }).defaultNow().notNull(),
})

export const db_metadata = pgTable('db_metadata', {
  key: text().primaryKey(),
  value: text(),
})

// Admin tables for PGlite sync

export const users = pgTable('users', {
  id: uuid().primaryKey(),
  email: text(),
  full_name: text(),
  avatar_url: text(),
  last_sign_in_at: timestamp({ withTimezone: true }),
  created_at: timestamp({ withTimezone: true }),
  unsubscribed_from_emails: timestamp({ withTimezone: true }),
  updated_at: timestamp({ withTimezone: true }).notNull(),
  local_saved_at: timestamp({ withTimezone: true }),
})

export const user_data = pgTable('user_data', {
  id: uuid().primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  terms_agreement: timestamp({ withTimezone: true }),
  unsubscribed_from_emails: timestamp({ withTimezone: true }),
  welcome_email_sent: timestamp({ withTimezone: true }),
  updated_at: timestamp({ withTimezone: true }).notNull(),
  local_saved_at: timestamp({ withTimezone: true }),
})

export const dictionaries = pgTable('dictionaries', {
  id: text().primaryKey(),
  name: text().notNull(),
  alternate_names: text().array(),
  gloss_languages: text().array(),
  location: text(),
  coordinates: jsonb().$type<Coordinates>(),
  iso_639_3: text(),
  glottocode: text(),
  public: boolean(),
  print_access: boolean(),
  metadata: jsonb().$type<DictionaryMetadata>(),
  entry_count: integer(),
  orthographies: jsonb().$type<Orthography[]>(),
  featured_image: jsonb().$type<DictionaryPhoto>(),
  author_connection: text(),
  community_permission: text(),
  language_used_by_community: boolean(),
  con_language_description: text(),
  copyright: text(),
  url: text(),
  created_at: timestamp({ withTimezone: true }).notNull(),
  created_by: uuid(),
  updated_at: timestamp({ withTimezone: true }).notNull(),
  updated_by: uuid(),
  local_saved_at: timestamp({ withTimezone: true }),
})

export const dictionary_roles = pgTable('dictionary_roles', {
  dictionary_id: text().notNull().references(() => dictionaries.id, { onDelete: 'cascade' }),
  user_id: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text().notNull(),
  created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  invited_by: uuid(),
  local_saved_at: timestamp({ withTimezone: true }),
}, table => [
  primaryKey({ columns: [table.dictionary_id, table.user_id, table.role] }),
])

export const invites = pgTable('invites', {
  id: uuid().primaryKey(),
  dictionary_id: text().notNull().references(() => dictionaries.id, { onDelete: 'cascade' }),
  created_by: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviter_email: text().notNull(),
  target_email: text().notNull(),
  role: text().notNull(),
  status: text().notNull(),
  created_at: timestamp({ withTimezone: true }).notNull(),
  local_saved_at: timestamp({ withTimezone: true }),
})

export const deletes = pgTable('deletes', {
  table_name: text().notNull(),
  id: text().notNull(),
  local_saved_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
}, table => [
  primaryKey({ columns: [table.table_name, table.id] }),
])

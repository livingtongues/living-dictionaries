import type {
  DictionaryCatalogMetadata,
  DictionaryCoordinates,
  FeaturedImage,
  Orthography,
  UserProviderIdentity,
} from './shared.types'
import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Drizzle schema for `shared.db`. Single source of truth for TypeScript types
 * on these tables. The DDL itself lives in `./shared-migrations/*.sql` —
 * keep the `CREATE TABLE` statements in sync when adding columns or tables.
 *
 * We access the DB with raw better-sqlite3 prepared statements (server) and
 * wa-sqlite (admin client), not Drizzle's query builder. JSON columns are
 * annotated with `$type<>()` so `InferSelectModel` returns the parsed shape —
 * the auto-parse driver in `./json-columns.ts` makes this truthful at runtime.
 *
 * The same migrations folder runs on BOTH the server's `shared.db` and every
 * admin client's wa-sqlite local DB. Server-only tables (`email_codes`,
 * `email_aliases`, `client_logs`) get created on the client too but stay
 * empty — they're excluded from `SYNCABLE_TABLE_NAMES` in `db/sync/types.ts`
 * so they never flow over the wire.
 */

export const migrations = sqliteTable('migrations', {
  id: text().primaryKey(),
  name: text().notNull(),
  run_on: text().notNull(),
})

export const db_metadata = sqliteTable('db_metadata', {
  key: text().primaryKey(),
  value: text(),
})

export const deletes = sqliteTable('deletes', {
  table_name: text().notNull(),
  id: text().notNull(),
  updated_at: text().notNull(),
})

export const users = sqliteTable('users', {
  id: text().primaryKey(),
  email: text().unique(),
  name: text(),
  avatar_url: text(),
  /**
   * All linked auth identities for this user. Each element is
   * `{ provider, provider_id }`. The FIRST element is the signup identity
   * and is never mutated after insert; additional elements are appended when
   * a user logs in with a new provider sharing the same verified email.
   */
  providers: text({ mode: 'json' }).$type<UserProviderIdentity[]>().notNull(),
  /**
   * ISO 8601 timestamp of when the user unsubscribed from non-transactional
   * email. NULL = they're still subscribed. UI surfaces a boolean via
   * `!!users.unsubscribed_from_emails`; admin tooling can read the value for
   * "unsubscribed since" reporting. Legacy LD stored this the same way.
   */
  unsubscribed_from_emails: text(),
  /**
   * Preferred i18n locale for outbound email + SSR layout language. Maps to
   * one of the locales in `lib/i18n/locales/`. NULL = use the request's
   * `Accept-Language` header on first visit, fall back to English.
   */
  preferred_locale: text(),
  /**
   * Touched at most once per day per user, driven by the sync engine's
   * `update_last_visit` flag (see `lib/db/sync/last-visit-ping.ts`).
   */
  last_visit_at: text(),
  /**
   * Per-admin notification channel: 'email' (default) or 'ntfy'. Governs every
   * TARGETED admin ping (message assignment + Team chat). Flipped via
   * /api/admin/set-notify-channel; read server-side by `notify_admin`. Only
   * meaningful for admins (non-admins are never pinged).
   */
  notify_channel: text({ enum: ['email', 'ntfy'] }).notNull().default('email'),
  created_at: text().notNull(),
  updated_at: text().notNull(),
})

/** Email-OTP one-time codes. Server-only — stays empty on admin clients. */
export const email_codes = sqliteTable('email_codes', {
  email: text().notNull(),
  code: text().notNull(),
  expires_at: text().notNull(),
  created_at: text().notNull(),
})

/**
 * Additional emails that resolve to a user's canonical row. `users.email` is
 * primary/login; everything else lives here. Server-only — the inbound email
 * endpoint resolves `from_user_id` via `users.email` UNION `email_aliases.email`.
 */
export const email_aliases = sqliteTable('email_aliases', {
  email: text().primaryKey(),
  user_id: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: text({ enum: ['auth', 'manual', 'inbound-match', 'historical-merge'] }).notNull(),
  verified_at: text(),
  created_at: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Dictionary catalog. One row per dictionary; per-dictionary content lives in
 * `dictionaries/{id}.db` files (see `lib/db/schemas/dictionary.ts`).
 */
export const dictionaries = sqliteTable('dictionaries', {
  id: text().primaryKey(),
  /** Optional human-friendly URL slug (legacy used the id itself, this stays separate). */
  url: text().unique(),
  name: text().notNull(),
  alternate_names: text({ mode: 'json' }).$type<string[]>(),
  gloss_languages: text({ mode: 'json' }).$type<string[]>(),
  location: text(),
  coordinates: text({ mode: 'json' }).$type<DictionaryCoordinates>(),
  iso_639_3: text(),
  glottocode: text(),
  /** Public listing visibility. NULL/0 = unlisted-but-URL-reachable, 1 = listed. */
  public: integer(),
  print_access: integer(),
  metadata: text({ mode: 'json' }).$type<DictionaryCatalogMetadata>(),
  /** Recounted by `mirror_dictionary_cursor` on every dict write (editor push + v1 API); stamped once by the cutover import. */
  entry_count: integer().notNull().default(0),
  orthographies: text({ mode: 'json' }).$type<Orthography[]>(),
  featured_image: text({ mode: 'json' }).$type<FeaturedImage>(),
  author_connection: text(),
  community_permission: text(),
  language_used_by_community: integer(),
  con_language_description: text(),
  copyright: text(),
  hide_living_tongues_logo: integer(),
  /** Long-form dictionary metadata (legacy `dictionary_info`, 1:1 with a dict). */
  about: text(),
  citation: text(),
  grammar: text(),
  write_in_collaborators: text({ mode: 'json' }).$type<string[]>(),
  /**
   * Last `dict.db.db_metadata.last_modified_at` mirrored here by the push
   * endpoint. Single source of truth for "is this dict due for an R2 rebuild?"
   * (used by the snapshot builder cron).
   */
  snapshot_uploaded_at: text(),
  /**
   * Last migration applied to this dict's `dictionaries/{id}.db` file.
   * NULL = newly registered, not yet opened by `get_dictionary_db`.
   */
  dict_db_schema_version: text(),
  created_at: text().notNull(),
  created_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
  updated_at: text().notNull(),
  updated_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
  dirty: integer(),
})

/**
 * Access-control rows: which user has what role on which dictionary.
 * Synthetic UUID PK (per Q8) + UNIQUE on (dictionary_id, user_id, role).
 */
export const dictionary_roles = sqliteTable('dictionary_roles', {
  id: text().primaryKey(),
  dictionary_id: text().notNull().references(() => dictionaries.id, { onDelete: 'cascade' }),
  user_id: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text({ enum: ['manager', 'editor', 'contributor'] }).notNull(),
  invited_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
  dirty: integer(),
  created_at: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Partner organizations shown on a dictionary's about page. The logo is
 * denormalized here (serving_url + storage_path copied from the legacy `photos`
 * row at migration time) so the about page renders entirely from shared.db.
 */
export const dictionary_partners = sqliteTable('dictionary_partners', {
  id: text().primaryKey(),
  dictionary_id: text().notNull().references(() => dictionaries.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  photo_storage_path: text(),
  photo_serving_url: text(),
  dirty: integer(),
  created_at: text().notNull(),
  updated_at: text().notNull(),
})

/** Outstanding invites (target email may not yet have a `users` row). */
export const invites = sqliteTable('invites', {
  id: text().primaryKey(),
  dictionary_id: text().notNull().references(() => dictionaries.id, { onDelete: 'cascade' }),
  inviter_user_id: text().notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviter_email: text().notNull(),
  target_email: text().notNull(),
  role: text({ enum: ['manager', 'editor', 'contributor'] }).notNull(),
  status: text({ enum: ['queued', 'sent', 'claimed', 'cancelled'] }).notNull(),
  dirty: integer(),
  created_at: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Conversation thread between a customer + admin. One row per thread. The
 * underlying `messages` and `message_attachments` belong to a thread via FK.
 * Created either from the contact form or from inbound email (D4).
 */
export const message_threads = sqliteTable('message_threads', {
  id: text().primaryKey(),
  subject: text(),
  source: text({ enum: ['contact_form', 'email'] }).notNull(),
  from_user_id: text().references(() => users.id, { onDelete: 'cascade' }),
  from_email: text().notNull(),
  from_name: text(),
  url: text(),
  last_message_at: text().notNull(),
  read_at: text(),
  replied_at: text(),
  replied_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
  resolved_at: text(),
  resolved_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
  dirty: integer(),
  created_at: text().notNull(),
  updated_at: text().notNull(),
  assigned_to_user_id: text().references(() => users.id, { onDelete: 'set null' }),
  assigned_at: text(),
  assigned_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
  to_email: text(),
  /**
   * AI triage (`20260625e_triage.sql`, `$lib/agent/triage/*`). Written
   * server-side by the agent system user after an inbound email is classified;
   * read live by the triage panel. `triage_verdict` is 'spam' | 'human' (LLM)
   * or 'notification' (auto-resolver marker the LLM never emits). `triage_*`
   * stay NULL until the env-gated pipeline runs.
   */
  triage_verdict: text({ enum: ['spam', 'human', 'notification'] }),
  triage_category: text({ enum: ['technical', 'content', 'account', 'partnership', 'other'] }),
  triage_confidence: text({ enum: ['high', 'low'] }),
  triage_summary: text(),
  triage_advice: text(),
  triage_draft_reply: text(),
  triage_at: text(),
})

export const messages = sqliteTable('messages', {
  id: text().primaryKey(),
  thread_id: text().notNull().references(() => message_threads.id, { onDelete: 'cascade' }),
  author_user_id: text().references(() => users.id, { onDelete: 'set null' }),
  author_kind: text({ enum: ['customer', 'admin', 'agent'] }).notNull(),
  body_text: text(),
  body_html: text(),
  message_id: text(),
  in_reply_to: text(),
  email_references: text(),
  raw_headers: text(),
  dirty: integer(),
  created_at: text().notNull(),
  updated_at: text().notNull(),
  sent_at: text(),
  delivery_status: text({ enum: ['pending', 'sent', 'failed'] }),
  delivery_error: text(),
})

export const message_attachments = sqliteTable('message_attachments', {
  id: text().primaryKey(),
  message_id: text().notNull().references(() => messages.id, { onDelete: 'cascade' }),
  filename: text().notNull(),
  mimetype: text().notNull(),
  size_bytes: integer().notNull(),
  content_id: text(),
  disposition: text({ enum: ['attachment', 'inline'] }).notNull(),
  storage_key: text().notNull(),
  dirty: integer(),
  created_at: text().notNull(),
  updated_at: text().notNull(),
})

/**
 * Client-side log entries POSTed from the browser to `/api/log`. Server-only:
 * never syncs to admin clients (not in `SYNCABLE_TABLE_NAMES`).
 */
export const client_logs = sqliteTable('client_logs', {
  id: text().primaryKey(),
  received_at: text().notNull(),
  client_time: text(),
  user_id: text(),
  level: text({ enum: ['error', 'warn', 'info', 'unhandled_rejection', 'crash'] }).notNull(),
  message: text().notNull(),
  stack: text(),
  url: text(),
  user_agent: text(),
  platform: text({ enum: ['web', 'ios', 'android'] }),
  app_version: text(),
  build_target: text(),
  context: text(),
  source: text({ enum: ['client', 'server'] }),
  /** Approximate location from Cloudflare edge headers, stamped server-side at ingest. NO raw IP. */
  country: text(),
  region: text(),
  city: text(),
  latitude: real(),
  longitude: real(),
})

/**
 * Per-dictionary API keys for the agent-friendly `/api/v1` write API
 * (see `20260629_api_keys.sql`). Server-only — the raw token is shown once on
 * creation and only its sha-256 hash is stored, so this table is absent from
 * `SYNCABLE_TABLE_NAMES` and has no `dirty` column (never reaches a browser).
 */
export const api_keys = sqliteTable('api_keys', {
  id: text().primaryKey(),
  dictionary_id: text().notNull().references(() => dictionaries.id, { onDelete: 'cascade' }),
  /** sha-256 hex of the raw token. The token itself is never stored. */
  token_hash: text().notNull().unique(),
  /** Leading chars for display, e.g. `ldk_a1b2c3`. */
  token_prefix: text().notNull(),
  /** Trailing 4 chars for display. */
  last_four: text().notNull(),
  label: text().notNull(),
  role: text({ enum: ['read', 'write'] }).notNull().default('write'),
  /** The human who minted the key; API writes are attributed to them. */
  created_by_user_id: text().references(() => users.id, { onDelete: 'set null' }),
  created_at: text().notNull(),
  /** Throttled (~once/minute) last-use stamp. */
  last_used_at: text(),
  /** Soft kill-switch — verify rejects when non-null. */
  revoked_at: text(),
})

/**
 * Forever rollup of `client_logs` (see `20260625b_log_daily_metrics.sql`). The
 * nightly log-retention cron aggregates each day before raw rows are archived.
 * Server-only: read live by `/admin/analytics`, never synced.
 */
export const log_daily_metrics = sqliteTable('log_daily_metrics', {
  day: text().notNull(),
  metric: text().notNull(),
  source: text({ enum: ['client', 'server'] }).notNull().default('client'),
  value: integer().notNull().default(0),
}, table => [primaryKey({ columns: [table.day, table.metric, table.source] })])

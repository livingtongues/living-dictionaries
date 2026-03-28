import type { PGlite } from '@electric-sql/pglite'
import type { Database } from '@living-dictionaries/types/supabase/combined.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type { SyncableTableName, SyncError, SyncLogEntry, SyncResult, TableFetchResult } from './types'
import { page } from '$app/state'
import { toast } from '$lib/components/ui/toast'
import * as local_schema from '$lib/pglite/schema'
import { eq } from 'drizzle-orm'
import { untrack } from 'svelte'
import { LOCAL_BATCH_SIZE, SYNC_BATCH_SIZE } from './constants'

type LocalDb = PgliteDatabase<typeof local_schema>
type Supabase = SupabaseClient<Database>

// Sentinel value: pass epoch to trigger which converts it to NULL (marks row as synced)
const SYNC_SENTINEL = new Date(0)

const DOWNLOAD_BATCH_SIZE = 200

const METADATA_KEYS = {
  SYNCED_UP_TO: 'synced_up_to',
  LAST_SYNCED_AT: 'last_synced_at',
} as const

// Tables grouped by foreign key dependencies for admin sync
// Tier 1: root tables (no FK dependencies)
// Tier 2: depends on tier 1
const SYNC_TIERS: SyncableTableName[][] = [
  ['users', 'dictionaries'],
  ['user_data', 'dictionary_roles', 'invites'],
]

// Tables that are read-only (downloaded but never uploaded)
const READ_ONLY_TABLES = new Set<SyncableTableName>(['users'])

// Tables that reference dictionaries.id via foreign key
const TABLES_WITH_DICTIONARY_FK = new Set<SyncableTableName>(['dictionary_roles', 'invites'])

// Tables that use created_at instead of updated_at (immutable after creation)
const CREATED_AT_TABLES = new Set<SyncableTableName>(['dictionary_roles', 'invites'])

// Tables that use text (not uuid) for their primary key
const TEXT_ID_TABLES = new Set<SyncableTableName>(['dictionaries'])

// Tables with composite primary keys (no id column)
const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  dictionary_roles: ['dictionary_id', 'user_id', 'role'],
}

function get_row_key(table_name: SyncableTableName, row: Record<string, unknown>): string {
  const pk_columns = COMPOSITE_PK_TABLES[table_name]
  if (pk_columns) {
    return pk_columns.map(col => String(row[col])).join('|')
  }
  return String(row.id)
}

// Mapping of local table to Supabase source (for download)
const DOWNLOAD_SOURCE: Record<SyncableTableName, 'rpc' | 'view' | 'table'> = {
  users: 'rpc',
  dictionaries: 'view',
  user_data: 'table',
  dictionary_roles: 'table',
  invites: 'table',
}

export class Sync {
  is_syncing = $state(false)
  last_error: string | null = $state(null)
  last_sync_result: SyncResult | null = $state(null)
  log_entries: SyncLogEntry[] = $state([])

  #log(entry: Omit<SyncLogEntry, 'timestamp'>) {
    this.log_entries.push({ ...entry, timestamp: new Date() })
  }

  async #yield() {
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  constructor(
    private local_db: LocalDb,
    private local_pg: PGlite,
    private supabase: Supabase,
  ) {
    $effect.root(() => {
      $effect(() => {
        if (page.url.pathname) {
          untrack(() => {
            this.#trigger_sync_if_needed()
          })
        }
      })
    })
  }

  async #trigger_sync_if_needed() {
    // TODO: re-enable auto-sync when ready
  }

  async sync_with_notice(): Promise<SyncResult> {
    try {
      const result = await this.sync()
      const parts: string[] = []
      if (result.items_uploaded > 0)
        parts.push(`${result.items_uploaded} ${page.data.t('sync.rows_uploaded')}`)
      if (result.items_downloaded > 0)
        parts.push(`${result.items_downloaded} ${page.data.t('sync.rows_downloaded')}`)
      if (result.deletes_pushed > 0)
        parts.push(`${result.deletes_pushed} ${page.data.t('sync.deletes_pushed')}`)
      if (result.deletes_pulled > 0)
        parts.push(`${result.deletes_pulled} ${page.data.t('sync.deletes_pulled')}`)
      toast.success(parts.join('\n') || page.data.t('sync.already_up_to_date'))
      if (result.errors.length > 0) {
        const [first_error] = result.errors
        const error_detail = 'word' in first_error
          ? `${first_error.word}: ${first_error.error}`
          : `${first_error.table_name}: ${first_error.error}`
        toast.error(`${result.errors.length} ${page.data.t('sync.sync_errors')}: ${error_detail}`)
      }
      return result
    } catch (error) {
      toast.error(`${page.data.t('sync.sync_error')}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  async sync(): Promise<SyncResult> {
    if (this.is_syncing) {
      throw new Error('Sync already in progress')
    }

    this.is_syncing = true
    this.last_error = null
    this.log_entries = []

    this.#log({ level: 'info', phase: 'start', message: 'Starting sync' })

    const start_time = Date.now()
    const errors: SyncError[] = []
    const uploaded_timestamps: string[] = []
    const downloaded_timestamps: string[] = []
    let deletes_pushed = 0
    let deletes_pulled = 0

    try {
      const synced_up_to = await this.get_synced_up_to()
      this.#log({ level: 'info', phase: 'start', message: `Synced up to: ${synced_up_to ?? 'never (first sync)'}` })

      // Phase 0: Handle deletes first (delete wins over update)
      this.#log({ level: 'info', phase: 'deletes', message: 'Syncing deletes...' })
      const delete_result = await this.sync_deletes(synced_up_to)
      deletes_pushed = delete_result.pushed
      deletes_pulled = delete_result.pulled
      errors.push(...delete_result.errors)
      this.#log({
        level: delete_result.errors.length > 0 ? 'warn' : 'info',
        phase: 'deletes',
        message: `Deletes: ${delete_result.pushed} pushed, ${delete_result.pulled} pulled`,
        row_count: delete_result.pushed + delete_result.pulled,
      })

      // Phase 1: Fetch and merge all tables in parallel
      this.#log({ level: 'info', phase: 'fetch', message: 'Fetching changes for all tables...' })
      const all_tables = SYNC_TIERS.flat()
      const fetch_results = await Promise.all(
        all_tables.map(table => this.fetch_and_merge_table(table, synced_up_to)),
      )

      // Create map for lookup
      const fetch_results_map = new Map<SyncableTableName, TableFetchResult>()
      for (const result of fetch_results) {
        fetch_results_map.set(result.table_name, result)
        errors.push(...result.errors)
        this.#log({
          level: result.errors.length > 0 ? 'warn' : 'info',
          phase: 'fetch',
          table: result.table_name,
          message: `${result.table_name}: ${result.to_upload.length} to upload, ${result.to_download.length} to download`,
          row_count: result.to_upload.length + result.to_download.length,
        })
      }

      // Filter out rows referencing deleted dictionaries
      const dictionaries_result = fetch_results_map.get('dictionaries')
      if (dictionaries_result) {
        const valid_dictionary_ids = new Set(
          [...dictionaries_result.to_download, ...dictionaries_result.to_upload]
            .map(row => row.id as string),
        )
        // Also include dictionaries already in local DB
        const local_dicts = await this.local_pg.query<{ id: string }>(`SELECT id FROM dictionaries`)
        for (const row of local_dicts.rows) {
          valid_dictionary_ids.add(row.id)
        }

        for (const table_name of TABLES_WITH_DICTIONARY_FK) {
          const table_result = fetch_results_map.get(table_name)
          if (!table_result) continue
          const before_download = table_result.to_download
          table_result.to_download = before_download.filter(
            row => valid_dictionary_ids.has(row.dictionary_id as string),
          )
          const removed = before_download.filter(
            row => !valid_dictionary_ids.has(row.dictionary_id as string),
          )
          if (removed.length > 0) {
            const dict_ids = [...new Set(removed.map(row => row.dictionary_id as string))]
            this.#log({ level: 'info', phase: 'fetch', table: table_name, message: `Filtered ${removed.length} rows referencing deleted dictionaries: ${dict_ids.join(', ')}` })
          }
        }
      }

      // Phase 2: Write in dependency order
      this.#log({ level: 'info', phase: 'write', message: 'Writing changes in dependency order...' })
      for (const tier of SYNC_TIERS) {
        const tier_results = tier
          .map(name => fetch_results_map.get(name))
          .filter((r): r is TableFetchResult => r !== undefined)

        const write_results = await Promise.all(
          tier_results.map(r => this.write_table_changes(r)),
        )

        for (const result of write_results) {
          uploaded_timestamps.push(...result.uploaded_timestamps)
          downloaded_timestamps.push(...result.downloaded_timestamps)
          errors.push(...result.errors)
          const table_name = tier_results[write_results.indexOf(result)]?.table_name
          if (result.uploaded_timestamps.length > 0 || result.downloaded_timestamps.length > 0) {
            this.#log({
              level: result.errors.length > 0 ? 'warn' : 'success',
              phase: 'write',
              table: table_name,
              message: `${table_name}: ${result.uploaded_timestamps.length} uploaded, ${result.downloaded_timestamps.length} downloaded`,
              row_count: result.uploaded_timestamps.length + result.downloaded_timestamps.length,
            })
          }
          for (const error of result.errors) {
            this.#log({
              level: 'error',
              phase: 'write',
              table: table_name,
              message: `Error in ${table_name}: ${error.error}`,
              detail: `Operation: ${error.operation}, ID: ${error.id}`,
            })
          }
        }
      }

      // Update synced_up_to
      const all_timestamps = [...uploaded_timestamps, ...downloaded_timestamps, ...delete_result.timestamps]
      if (all_timestamps.length > 0) {
        const max_ts = all_timestamps.reduce((a, b) => a > b ? a : b)
        await this.update_synced_up_to(max_ts)
      }

      await this.update_last_synced_at(new Date())

      const sync_result: SyncResult = {
        success: errors.length === 0,
        items_uploaded: uploaded_timestamps.length,
        items_downloaded: downloaded_timestamps.length,
        deletes_pushed,
        deletes_pulled,
        errors,
        duration_ms: Date.now() - start_time,
        last_sync_time: new Date().toISOString(),
      }

      this.last_sync_result = sync_result

      this.#log({
        level: sync_result.success ? 'success' : 'warn',
        phase: 'complete',
        message: `Sync complete in ${sync_result.duration_ms}ms — ${sync_result.items_uploaded} up, ${sync_result.items_downloaded} down, ${sync_result.errors.length} errors`,
      })

      return sync_result
    } catch (error) {
      this.last_error = error instanceof Error ? error.message : 'Unknown error'
      this.#log({
        level: 'error',
        phase: 'complete',
        message: `Sync failed: ${this.last_error}`,
        detail: error instanceof Error ? error.stack : undefined,
      })
      errors.push({
        operation: 'download',
        table_name: 'unknown',
        id: '',
        error: this.last_error,
      })
      const fail_result: SyncResult = {
        success: false,
        items_uploaded: 0,
        items_downloaded: 0,
        deletes_pushed: 0,
        deletes_pulled: 0,
        errors,
        duration_ms: Date.now() - start_time,
        last_sync_time: null,
      }
      this.last_sync_result = fail_result
      return fail_result
    } finally {
      this.is_syncing = false
    }
  }

  private async get_synced_up_to(): Promise<string | null> {
    const result = await this.local_db
      .select()
      .from(local_schema.db_metadata)
      .where(eq(local_schema.db_metadata.key, METADATA_KEYS.SYNCED_UP_TO))
    return result[0]?.value ?? null
  }

  private async update_synced_up_to(timestamp: string): Promise<void> {
    await this.local_db
      .insert(local_schema.db_metadata)
      .values({ key: METADATA_KEYS.SYNCED_UP_TO, value: timestamp })
      .onConflictDoUpdate({
        target: local_schema.db_metadata.key,
        set: { value: timestamp },
      })
  }

  private async update_last_synced_at(timestamp: Date): Promise<void> {
    await this.local_db
      .insert(local_schema.db_metadata)
      .values({ key: METADATA_KEYS.LAST_SYNCED_AT, value: timestamp.toISOString() })
      .onConflictDoUpdate({
        target: local_schema.db_metadata.key,
        set: { value: timestamp.toISOString() },
      })
  }

  private async fetch_and_merge_table(
    table_name: SyncableTableName,
    synced_up_to: string | null,
  ): Promise<TableFetchResult> {
    const errors: SyncError[] = []
    const [cloud_changes, local_dirty_rows] = await Promise.all([
      this.fetch_cloud_changes(table_name, synced_up_to),
      this.fetch_local_changes(table_name),
    ])

    const local_existing_rows = cloud_changes.length > 0
      ? await this.fetch_local_rows_by_keys(table_name, cloud_changes)
      : []

    const { to_upload, to_download } = this.merge_changes(table_name, local_dirty_rows, cloud_changes, local_existing_rows)
    return { table_name, to_upload, to_download, errors }
  }

  private async fetch_local_rows_by_keys(table_name: SyncableTableName, cloud_rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    if (cloud_rows.length === 0)
      return []

    const pk_columns = COMPOSITE_PK_TABLES[table_name]

    if (pk_columns) {
      const all_rows: Record<string, unknown>[] = []
      for (const cloud_row of cloud_rows) {
        const conditions = pk_columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ')
        const params = pk_columns.map(col => cloud_row[col])
        const result = await this.local_pg.query<Record<string, unknown>>(
          `SELECT * FROM ${table_name} WHERE ${conditions}`,
          params,
        )
        all_rows.push(...result.rows)
      }
      return all_rows
    }

    const ids = cloud_rows.map(row => row.id as string)
    const all_rows: Record<string, unknown>[] = []

    for (let i = 0; i < ids.length; i += LOCAL_BATCH_SIZE) {
      const batch = ids.slice(i, i + LOCAL_BATCH_SIZE)
      const placeholders = batch.map((_, j) => `$${j + 1}`).join(', ')
      const result = await this.local_pg.query<Record<string, unknown>>(
        `SELECT * FROM ${table_name} WHERE id IN (${placeholders})`,
        batch,
      )
      all_rows.push(...result.rows)
    }

    return all_rows
  }

  private async fetch_cloud_changes(table_name: SyncableTableName, since: string | null): Promise<Record<string, unknown>[]> {
    const source = DOWNLOAD_SOURCE[table_name]

    if (source === 'rpc') {
      return this.fetch_from_rpc(table_name, since)
    }

    const supabase_table = source === 'view' ? `${table_name}_view` : table_name
    const timestamp_column = CREATED_AT_TABLES.has(table_name) ? 'created_at' : 'updated_at'
    const all_rows: Record<string, unknown>[] = []
    let page_num = 0
    let has_more = true

    while (has_more) {
      let query = this.supabase.from(supabase_table as any)
        .select('*')
        .order(timestamp_column, { ascending: true })
        .range(page_num * SYNC_BATCH_SIZE, (page_num + 1) * SYNC_BATCH_SIZE - 1)

      if (since) {
        query = query.gt(timestamp_column, since)
      }

      const { data, error } = await query
      if (error)
        throw new Error(error.message)

      if (!data || data.length === 0) {
        has_more = false
      } else {
        all_rows.push(...(data as unknown as Record<string, unknown>[]))
        has_more = data.length === SYNC_BATCH_SIZE
        page_num++
      }
    }
    this.#log({ level: 'info', phase: 'fetch', table: table_name, message: `Fetched ${all_rows.length} rows from ${supabase_table}`, row_count: all_rows.length })
    return all_rows
  }

  private async fetch_from_rpc(table_name: SyncableTableName, since: string | null): Promise<Record<string, unknown>[]> {
    if (table_name !== 'users') {
      throw new Error(`RPC fetch not supported for table: ${table_name}`)
    }

    const { data, error } = await this.supabase.rpc('users_for_admin_table')
    if (error)
      throw new Error(error.message)

    if (!data)
      return []

    let result = data as Record<string, unknown>[]
    if (since) {
      result = result.filter((row) => {
        const updated_at = row.updated_at as string
        return updated_at && updated_at > since
      })
    }

    this.#log({ level: 'info', phase: 'fetch', table: 'users', message: `Fetched ${result.length} users from RPC`, row_count: result.length })
    return result
  }

  private async fetch_local_changes(table_name: SyncableTableName): Promise<Record<string, unknown>[]> {
    const result = await this.local_pg.query<Record<string, unknown>>(
      `SELECT * FROM ${table_name} WHERE local_saved_at IS NOT NULL`,
    )
    return result.rows
  }

  private merge_changes(
    table_name: SyncableTableName,
    local_dirty: Record<string, unknown>[],
    cloud: Record<string, unknown>[],
    local_existing: Record<string, unknown>[],
  ): { to_upload: Record<string, unknown>[], to_download: Record<string, unknown>[] } {
    const local_dirty_map = new Map(local_dirty.map(item => [get_row_key(table_name, item), item]))
    const local_existing_map = new Map(local_existing.map(item => [get_row_key(table_name, item), item]))
    const cloud_map = new Map(cloud.map(item => [get_row_key(table_name, item), item]))

    const timestamp_column = CREATED_AT_TABLES.has(table_name) ? 'created_at' : 'updated_at'
    const to_upload: Record<string, unknown>[] = []
    const to_download: Record<string, unknown>[] = []

    for (const [key, local_item] of local_dirty_map) {
      const cloud_item = cloud_map.get(key)
      if (!cloud_item) {
        to_upload.push(local_item)
      } else {
        const local_ts = (local_item.local_saved_at as Date)?.getTime() ?? 0
        const cloud_ts = new Date(cloud_item[timestamp_column] as string).getTime()
        if (local_ts > cloud_ts)
          to_upload.push(local_item)
      }
    }

    for (const [key, cloud_item] of cloud_map) {
      const local_dirty_item = local_dirty_map.get(key)
      const local_existing_item = local_existing_map.get(key)

      if (!local_existing_item) {
        to_download.push(cloud_item)
      } else if (local_dirty_item) {
        const local_ts = (local_dirty_item.local_saved_at as Date)?.getTime() ?? 0
        const cloud_ts = new Date(cloud_item[timestamp_column] as string).getTime()
        if (cloud_ts > local_ts)
          to_download.push(cloud_item)
      } else {
        const local_timestamp = local_existing_item[timestamp_column]
        const local_ts = local_timestamp ? new Date(local_timestamp as string).getTime() : 0
        const cloud_ts = new Date(cloud_item[timestamp_column] as string).getTime()
        if (cloud_ts > local_ts)
          to_download.push(cloud_item)
      }
    }

    return { to_upload, to_download }
  }

  private async write_table_changes(
    fetch_result: TableFetchResult,
  ): Promise<{ uploaded_timestamps: string[], downloaded_timestamps: string[], errors: SyncError[] }> {
    const { table_name, to_upload, to_download } = fetch_result
    const errors: SyncError[] = [...fetch_result.errors]
    const uploaded_timestamps: string[] = []
    const downloaded_timestamps: string[] = []
    const timestamp_column = CREATED_AT_TABLES.has(table_name) ? 'created_at' : 'updated_at'

    // Upload to Supabase (skip read-only tables like users)
    if (to_upload.length > 0 && !READ_ONLY_TABLES.has(table_name)) {
      this.#log({ level: 'info', phase: 'upload', table: table_name, message: `Uploading ${to_upload.length} rows`, row_count: to_upload.length })
      const upload_result = await this.upload_to_supabase(table_name, to_upload)
      uploaded_timestamps.push(...upload_result.timestamps)
      errors.push(...upload_result.errors)
      await this.#yield()
    }

    // Download to local in batches
    if (to_download.length > 0) {
      this.#log({ level: 'info', phase: 'download', table: table_name, message: `Downloading ${to_download.length} rows`, row_count: to_download.length })
      for (let offset = 0; offset < to_download.length; offset += DOWNLOAD_BATCH_SIZE) {
        const batch = to_download.slice(offset, offset + DOWNLOAD_BATCH_SIZE)
        try {
          await this.save_batch_to_local(table_name, batch)
          for (const item of batch) {
            downloaded_timestamps.push(item[timestamp_column] as string)
          }
        } catch {
          // Batch failed — fall back to one-by-one to save what we can
          for (const item of batch) {
            try {
              await this.save_batch_to_local(table_name, [item])
              downloaded_timestamps.push(item[timestamp_column] as string)
            } catch (single_err) {
              errors.push({ operation: 'download', table_name, id: get_row_key(table_name, item), error: String(single_err) })
            }
          }
        }
        await this.#yield()
      }
    }

    return { uploaded_timestamps, downloaded_timestamps, errors }
  }

  private async upload_to_supabase(
    table_name: SyncableTableName,
    items: Record<string, unknown>[],
  ): Promise<{ timestamps: string[], errors: SyncError[] }> {
    const errors: SyncError[] = []
    const timestamps: string[] = []

    const upload_data = items.map(item => this.prepare_for_supabase(table_name, item))
    const pk_columns = COMPOSITE_PK_TABLES[table_name]
    const timestamp_column = CREATED_AT_TABLES.has(table_name) ? 'created_at' : 'updated_at'
    const on_conflict = pk_columns ? pk_columns.join(',') : 'id'
    const select_columns = pk_columns ? [...pk_columns, timestamp_column].join(',') : `id,${timestamp_column}`

    const { error, data } = await this.supabase.from(table_name as any)
      .upsert(upload_data as any[], { onConflict: on_conflict })
      .select(select_columns)

    if (error) {
      console.error(`[sync] Error uploading to ${table_name}:`, error)
      errors.push({ operation: 'upload', table_name, id: '', error: error.message })
      return { timestamps, errors }
    }

    if (data && (data as any[]).length > 0) {
      const rows = data as any[]
      for (const row of rows) {
        const timestamp_value = row[timestamp_column] || row.created_at
        if (timestamp_value) timestamps.push(timestamp_value as string)
      }

      if (pk_columns) {
        // Composite PK: batch update one at a time (can't easily batch composite keys)
        for (const row of rows) {
          const conditions = pk_columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ')
          const params = [...pk_columns.map(col => row[col]), SYNC_SENTINEL]
          await this.local_pg.query(
            `UPDATE ${table_name} SET local_saved_at = $${pk_columns.length + 1} WHERE ${conditions}`,
            params,
          )
        }
      } else {
        // id-based tables: single batch UPDATE
        const params: unknown[] = []
        const value_rows: string[] = []
        for (const row of rows) {
          const timestamp_value = row[timestamp_column] || row.created_at
          params.push(row.id, timestamp_value)
          const id_cast = TEXT_ID_TABLES.has(table_name) ? '' : '::uuid'
          value_rows.push(`($${params.length - 1}${id_cast}, $${params.length}::timestamptz)`)
        }
        params.push(SYNC_SENTINEL)

        if (CREATED_AT_TABLES.has(table_name)) {
          await this.local_pg.query(
            `UPDATE ${table_name} SET
              local_saved_at = $${params.length}::timestamptz
            FROM (VALUES ${value_rows.join(', ')}) AS batch(id, ts)
            WHERE ${table_name}.id = batch.id`,
            params,
          )
        } else {
          await this.local_pg.query(
            `UPDATE ${table_name} SET
              updated_at = batch.ts,
              local_saved_at = $${params.length}::timestamptz
            FROM (VALUES ${value_rows.join(', ')}) AS batch(id, ts)
            WHERE ${table_name}.id = batch.id`,
            params,
          )
        }
      }
    }

    return { timestamps, errors }
  }

  private prepare_for_supabase(table_name: SyncableTableName, item: Record<string, unknown>): Record<string, unknown> {
    const result = { ...item }
    delete result.local_saved_at
    delete result.entry_count

    if (!CREATED_AT_TABLES.has(table_name)) {
      delete result.updated_at
    }

    for (const key of Object.keys(result)) {
      if (result[key] instanceof Date) {
        result[key] = (result[key] as Date).toISOString()
      }
      if (result[key] === null) {
        delete result[key]
      }
    }
    return result
  }

  private async save_batch_to_local(table_name: SyncableTableName, cloud_items: Record<string, unknown>[]): Promise<void> {
    if (cloud_items.length === 0)
      return

    // Prepare first item to determine columns
    const first = { ...cloud_items[0] }
    first.local_saved_at = SYNC_SENTINEL
    if (table_name === 'users' && !first.updated_at) {
      first.updated_at = first.created_at || new Date().toISOString()
    }

    const columns = Object.keys(first)
    const columns_sql = columns.join(', ')

    const pk_columns = COMPOSITE_PK_TABLES[table_name]
    const conflict_target = pk_columns
      ? `(${pk_columns.join(', ')})`
      : '(id)'
    // Exclude local_saved_at from ON CONFLICT SET — PGlite's BEFORE trigger
    // doesn't see EXCLUDED values correctly (it sees the UPDATE and sets
    // local_saved_at = NOW() before checking for the epoch sentinel). Direct
    // parameter references ($3) work but EXCLUDED references don't, and we need
    // EXCLUDED for multi-row batch inserts. So we do a separate UPDATE afterward.
    const update_columns = columns.filter(col =>
      col !== 'local_saved_at' && (pk_columns ? !pk_columns.includes(col) : col !== 'id'),
    )
    const update_set = update_columns.map(col => `${col} = EXCLUDED.${col}`).join(', ')

    const params: unknown[] = []
    const value_groups: string[] = []

    for (const cloud_item of cloud_items) {
      const local_item = { ...cloud_item }
      local_item.local_saved_at = SYNC_SENTINEL
      if (table_name === 'users' && !local_item.updated_at) {
        local_item.updated_at = local_item.created_at || new Date().toISOString()
      }

      const placeholders = columns.map((col) => {
        params.push(local_item[col])
        return `$${params.length}`
      })
      value_groups.push(`(${placeholders.join(', ')})`)
    }

    await this.local_pg.query(
      `INSERT INTO ${table_name} (${columns_sql}) VALUES ${value_groups.join(', ')}
       ON CONFLICT ${conflict_target} DO UPDATE SET ${update_set}`,
      params,
    )

    // Mark all rows as synced via separate UPDATE (trigger converts epoch → NULL)
    if (pk_columns) {
      const tuples: string[] = []
      const tuple_params: unknown[] = [SYNC_SENTINEL]
      for (const cloud_item of cloud_items) {
        const placeholders = pk_columns.map((col) => {
          tuple_params.push(cloud_item[col])
          return `$${tuple_params.length}`
        })
        tuples.push(`(${placeholders.join(', ')})`)
      }
      const pk_list = pk_columns.join(', ')
      await this.local_pg.query(
        `UPDATE ${table_name} SET local_saved_at = $1 WHERE (${pk_list}) IN (${tuples.join(', ')})`,
        tuple_params,
      )
    } else {
      const ids = cloud_items.map(item => item.id)
      const id_placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
      await this.local_pg.query(
        `UPDATE ${table_name} SET local_saved_at = $${ids.length + 1} WHERE id IN (${id_placeholders})`,
        [...ids, SYNC_SENTINEL],
      )
    }
  }

  private async sync_deletes(synced_up_to: string | null): Promise<{ pushed: number, pulled: number, timestamps: string[], errors: SyncError[] }> {
    const errors: SyncError[] = []
    let pushed = 0
    let pulled = 0

    const local_deletes = await this.local_db.select().from(local_schema.deletes)

    const pull_result = await this.pull_remote_deletes(synced_up_to)
    pulled = pull_result.count
    errors.push(...pull_result.errors)

    if (local_deletes.length > 0) {
      const push_result = await this.push_local_deletes(local_deletes)
      pushed = push_result.count
      errors.push(...push_result.errors)
    }

    if (local_deletes.length > 0 || pulled > 0) {
      await this.local_db.delete(local_schema.deletes)
    }

    return { pushed, pulled, timestamps: pull_result.timestamps, errors }
  }

  private async pull_remote_deletes(since: string | null): Promise<{ count: number, timestamps: string[], errors: SyncError[] }> {
    const errors: SyncError[] = []

    if (!since) {
      const { data, error } = await this.supabase
        .from('deletes' as any)
        .select('deleted_at')
        .order('deleted_at', { ascending: false })
        .limit(1)
      if (error) {
        errors.push({ operation: 'delete_pull', table_name: 'deletes', id: '', error: error.message })
        return { count: 0, timestamps: [], errors }
      }
      const timestamps: string[] = (data as any[])?.length ? [(data as any[])[0].deleted_at as string] : []
      return { count: 0, timestamps, errors }
    }

    const { data, error } = await this.supabase
      .from('deletes' as any)
      .select('*')
      .gt('deleted_at', since)

    if (error) {
      errors.push({ operation: 'delete_pull', table_name: 'deletes', id: '', error: error.message })
      return { count: 0, timestamps: [], errors }
    }

    if (!data || data.length === 0)
      return { count: 0, timestamps: [], errors }

    const timestamps: string[] = (data as any[]).map(d => d.deleted_at as string)
    let applied_count = 0

    for (const remote_delete of data as any[]) {
      try {
        await this.local_pg.query(
          `INSERT INTO deletes (table_name, id, local_saved_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [remote_delete.table_name, remote_delete.id, SYNC_SENTINEL],
        )
        applied_count++
      } catch (err) {
        errors.push({
          operation: 'delete_pull',
          table_name: remote_delete.table_name,
          id: remote_delete.id,
          error: String(err),
        })
      }
    }

    return { count: applied_count, timestamps, errors }
  }

  private async push_local_deletes(local_deletes: typeof local_schema.deletes.$inferSelect[]): Promise<{ count: number, errors: SyncError[] }> {
    const errors: SyncError[] = []

    const { error } = await this.supabase
      .from('deletes' as any)
      .upsert(local_deletes.map(d => ({
        table_name: d.table_name,
        id: d.id,
      })))

    if (error) {
      console.error('[sync] Error pushing deletes:', error)
      errors.push({ operation: 'delete_push', table_name: 'user_deletes', id: '', error: error.message })
      return { count: 0, errors }
    }

    return { count: local_deletes.length, errors }
  }
}

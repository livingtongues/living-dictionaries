import type { PGlite } from '@electric-sql/pglite'
import type { Database } from '@living-dictionaries/types/supabase/combined.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type { SyncableTableName, SyncError, SyncResult, TableFetchResult } from './types'
import { page } from '$app/state'
import * as local_schema from '$lib/pglite/schema'
import { toast } from '$lib/svelte-pieces-5/toast'
import { eq } from 'drizzle-orm'
import { untrack } from 'svelte'
import { LOCAL_BATCH_SIZE, SYNC_BATCH_SIZE } from './constants'

type LocalDb = PgliteDatabase<typeof local_schema>
type Supabase = SupabaseClient<Database>

// Sentinel value: pass epoch to trigger which converts it to NULL (marks row as synced)
const SYNC_SENTINEL = new Date(0)

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

// Tables that use created_at instead of updated_at (immutable after creation)
const CREATED_AT_TABLES = new Set<SyncableTableName>(['dictionary_roles', 'invites'])

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
// users comes from RPC, dictionaries from view, rest from tables
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
    // const now = Date.now()
    // if (now - this.last_sync_time > SYNC_COOLDOWN_MS && !this.is_syncing) {
    //   try {
    //     await this.full_sync()
    //   } catch (error) {
    //     console.error('Sync failed:', error)
    //   }
    // } else {
    //   console.info(`Will not sync yet. Still need ${Math.ceil((SYNC_COOLDOWN_MS - (now - this.last_sync_time)) / 60000)} more minutes of cooldown.`)
    // }
  }

  async sync_with_notice(): Promise<SyncResult> {
    try {
      const result = await this.sync()
      const parts = [
        `${result.items_uploaded} ${page.data.t('sync.rows_uploaded')}`,
        `${result.items_downloaded} ${page.data.t('sync.rows_downloaded')}`,
      ]
      if (result.deletes_pushed > 0) {
        parts.push(`${result.deletes_pushed} ${page.data.t('sync.deletes_pushed')}`)
      }
      if (result.deletes_pulled > 0) {
        parts.push(`${result.deletes_pulled} ${page.data.t('sync.deletes_pulled')}`)
      }
      toast.success(parts.join('\n'))
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

    const start_time = Date.now()
    const errors: SyncError[] = []
    const uploaded_timestamps: Date[] = []
    const downloaded_timestamps: Date[] = []
    let deletes_pushed = 0
    let deletes_pulled = 0

    try {
      const synced_up_to = await this.get_synced_up_to()

      // Phase 0: Handle deletes first (delete wins over update)
      const delete_result = await this.sync_deletes(synced_up_to)
      deletes_pushed = delete_result.pushed
      deletes_pulled = delete_result.pulled
      errors.push(...delete_result.errors)

      // Phase 1: Fetch and merge all tables in parallel
      const all_tables = SYNC_TIERS.flat()
      const fetch_results = await Promise.all(
        all_tables.map(table => this.fetch_and_merge_table(table, synced_up_to)),
      )

      // Create map for lookup
      const fetch_results_map = new Map<SyncableTableName, TableFetchResult>()
      for (const result of fetch_results) {
        fetch_results_map.set(result.table_name, result)
        errors.push(...result.errors)
      }

      // Phase 2: Write in dependency order
      for (const tier of SYNC_TIERS) {
        console.log(`[sync] Processing tier:`, tier)
        const tier_results = tier
          .map(name => fetch_results_map.get(name))
          .filter((r): r is TableFetchResult => r !== undefined)

        const write_results = await Promise.all(
          tier_results.map(r => this.write_table_changes(r)),
        )
        console.log(`[sync] Tier complete:`, tier)

        for (const result of write_results) {
          uploaded_timestamps.push(...result.uploaded_timestamps)
          downloaded_timestamps.push(...result.downloaded_timestamps)
          errors.push(...result.errors)
        }
      }

      // Update synced_up_to
      const all_timestamps = [...uploaded_timestamps, ...downloaded_timestamps]
      if (all_timestamps.length > 0) {
        const max_ts = new Date(Math.max(...all_timestamps.map(d => d.getTime())))
        await this.update_synced_up_to(max_ts)
      }

      await this.update_last_synced_at(new Date())

      return {
        success: errors.length === 0,
        items_uploaded: uploaded_timestamps.length,
        items_downloaded: downloaded_timestamps.length,
        deletes_pushed,
        deletes_pulled,
        errors,
        duration_ms: Date.now() - start_time,
        last_sync_time: new Date().toISOString(),
      }
    } catch (error) {
      this.last_error = error instanceof Error ? error.message : 'Unknown error'
      errors.push({
        operation: 'download',
        table_name: 'unknown',
        id: '',
        error: this.last_error,
      })
      return {
        success: false,
        items_uploaded: 0,
        items_downloaded: 0,
        deletes_pushed: 0,
        deletes_pulled: 0,
        errors,
        duration_ms: Date.now() - start_time,
        last_sync_time: null,
      }
    } finally {
      this.is_syncing = false
    }
  }

  private async get_synced_up_to(): Promise<Date | null> {
    const result = await this.local_db
      .select()
      .from(local_schema.db_metadata)
      .where(eq(local_schema.db_metadata.key, METADATA_KEYS.SYNCED_UP_TO))
    const date_string = result[0]?.value
    if (!date_string)
      return null
    return new Date(date_string)
  }

  private async update_synced_up_to(timestamp: Date): Promise<void> {
    await this.local_db
      .insert(local_schema.db_metadata)
      .values({ key: METADATA_KEYS.SYNCED_UP_TO, value: timestamp.toISOString() })
      .onConflictDoUpdate({
        target: local_schema.db_metadata.key,
        set: { value: timestamp.toISOString() },
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
    synced_up_to: Date | null,
  ): Promise<TableFetchResult> {
    const errors: SyncError[] = []
    const [cloud_changes, local_dirty_rows] = await Promise.all([
      this.fetch_cloud_changes(table_name, synced_up_to),
      this.fetch_local_changes(table_name),
    ])

    // Get keys of cloud rows to check which ones exist locally (including clean rows)
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
      // For composite PK tables, fetch each row individually
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

    // For simple id-based tables
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

  private async fetch_cloud_changes(table_name: SyncableTableName, since: Date | null): Promise<Record<string, unknown>[]> {
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
        query = query.gt(timestamp_column, since.toISOString())
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
    console.log(`[sync] Fetched ${all_rows.length} rows from ${supabase_table}`)
    return all_rows
  }

  private async fetch_from_rpc(table_name: SyncableTableName, since: Date | null): Promise<Record<string, unknown>[]> {
    if (table_name !== 'users') {
      throw new Error(`RPC fetch not supported for table: ${table_name}`)
    }

    // Fetch users via RPC - returns all users for admin table
    // TODO: Add pagination and since filter when RPC supports it
    const { data, error } = await this.supabase.rpc('users_for_admin_table')
    if (error)
      throw new Error(error.message)

    if (!data)
      return []

    // Filter by since if provided
    if (since) {
      return data.filter((row: Record<string, unknown>) => {
        const updated_at = row.updated_at as string
        return updated_at && new Date(updated_at) > since
      })
    }

    console.log(`[sync] Fetched ${data.length} users from RPC`)
    return data as Record<string, unknown>[]
  }

  private async fetch_local_changes(table_name: SyncableTableName): Promise<Record<string, unknown>[]> {
    // Fetch rows where local_saved_at IS NOT NULL (dirty/needs sync)
    // local_saved_at = NULL means synced (trigger converts epoch sentinel to NULL)
    // local_saved_at = timestamp means needs sync (trigger sets on app saves)
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
    // local_dirty: rows with local_saved_at IS NOT NULL (need to be uploaded)
    // local_existing: all local rows that match cloud keys (to check for conflicts)
    const local_dirty_map = new Map(local_dirty.map(item => [get_row_key(table_name, item), item]))
    const local_existing_map = new Map(local_existing.map(item => [get_row_key(table_name, item), item]))
    const cloud_map = new Map(cloud.map(item => [get_row_key(table_name, item), item]))

    const timestamp_column = CREATED_AT_TABLES.has(table_name) ? 'created_at' : 'updated_at'
    const to_upload: Record<string, unknown>[] = []
    const to_download: Record<string, unknown>[] = []

    // Determine what needs to be uploaded
    for (const [key, local_item] of local_dirty_map) {
      const cloud_item = cloud_map.get(key)
      if (!cloud_item) {
        // Not in cloud at all, upload it
        to_upload.push(local_item)
      } else {
        // Compare timestamps - local wins if local_saved_at > cloud timestamp
        const local_ts = (local_item.local_saved_at as Date)?.getTime() ?? 0
        const cloud_ts = new Date(cloud_item[timestamp_column] as string).getTime()
        if (local_ts > cloud_ts)
          to_upload.push(local_item)
      }
    }

    // Determine what needs to be downloaded
    for (const [key, cloud_item] of cloud_map) {
      const local_dirty_item = local_dirty_map.get(key)
      const local_existing_item = local_existing_map.get(key)

      if (!local_existing_item) {
        // Doesn't exist locally at all, download it
        to_download.push(cloud_item)
      } else if (local_dirty_item) {
        // Exists locally AND is dirty - only download if cloud is newer
        const local_ts = (local_dirty_item.local_saved_at as Date)?.getTime() ?? 0
        const cloud_ts = new Date(cloud_item[timestamp_column] as string).getTime()
        if (cloud_ts > local_ts)
          to_download.push(cloud_item)
      } else {
        // Exists locally but is clean (local_saved_at IS NULL)
        // Compare cloud timestamp with local timestamp
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
  ): Promise<{ uploaded_timestamps: Date[], downloaded_timestamps: Date[], errors: SyncError[] }> {
    const { table_name, to_upload, to_download } = fetch_result
    const errors: SyncError[] = [...fetch_result.errors]
    const uploaded_timestamps: Date[] = []
    const downloaded_timestamps: Date[] = []
    const timestamp_column = CREATED_AT_TABLES.has(table_name) ? 'created_at' : 'updated_at'

    // Upload to Supabase (skip read-only tables like users)
    if (to_upload.length > 0 && !READ_ONLY_TABLES.has(table_name)) {
      const upload_result = await this.upload_to_supabase(table_name, to_upload)
      uploaded_timestamps.push(...upload_result.timestamps)
      errors.push(...upload_result.errors)
    }

    // Download to local
    console.log(`[sync] Downloading ${to_download.length} rows to ${table_name}`)
    for (const item of to_download) {
      try {
        console.log(`[sync] Saving to ${table_name}:`, item.id ?? get_row_key(table_name, item))
        await this.save_to_local(table_name, item)
        downloaded_timestamps.push(new Date(item[timestamp_column] as string))
      } catch (err) {
        console.error(`[sync] Error saving to ${table_name}:`, item, err)
        errors.push({ operation: 'download', table_name, id: get_row_key(table_name, item), error: String(err) })
      }
    }

    return { uploaded_timestamps, downloaded_timestamps, errors }
  }

  private async upload_to_supabase(
    table_name: SyncableTableName,
    items: Record<string, unknown>[],
  ): Promise<{ timestamps: Date[], errors: SyncError[] }> {
    const errors: SyncError[] = []
    const timestamps: Date[] = []

    const upload_data = items.map(item => this.prepare_for_supabase(table_name, item))
    const pk_columns = COMPOSITE_PK_TABLES[table_name]
    const timestamp_column = CREATED_AT_TABLES.has(table_name) ? 'created_at' : 'updated_at'
    const on_conflict = pk_columns ? pk_columns.join(',') : 'id'
    const select_columns = pk_columns ? [...pk_columns, timestamp_column].join(',') : `id,${timestamp_column}`

    const { error, data } = await this.supabase.from(table_name as any)
      .upsert(upload_data as any[], { onConflict: on_conflict })
      .select(select_columns)

    if (error) {
      errors.push({ operation: 'upload', table_name, id: '', error: error.message })
      return { timestamps, errors }
    }

    if (data) {
      // Mark uploaded rows as synced
      for (const row of data as any[]) {
        const timestamp_value = row[timestamp_column] || row.created_at
        if (timestamp_value) timestamps.push(new Date(timestamp_value))

        if (pk_columns) {
          const conditions = pk_columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ')
          const params = [...pk_columns.map(col => row[col]), SYNC_SENTINEL]
          await this.local_pg.query(
            `UPDATE ${table_name} SET local_saved_at = $${pk_columns.length + 1} WHERE ${conditions}`,
            params,
          )
        } else {
          if (CREATED_AT_TABLES.has(table_name)) {
            await this.local_pg.query(
              `UPDATE ${table_name} SET local_saved_at = $1 WHERE id = $2`,
              [SYNC_SENTINEL, row.id],
            )
          } else {
            await this.local_pg.query(
              `UPDATE ${table_name} SET updated_at = $1, local_saved_at = $2 WHERE id = $3`,
              [timestamp_value, SYNC_SENTINEL, row.id],
            )
          }
        }
      }
    }

    return { timestamps, errors }
  }

  private prepare_for_supabase(table_name: SyncableTableName, item: Record<string, unknown>): Record<string, unknown> {
    const result = { ...item }
    delete result.local_saved_at
    delete result.entry_count // Computed column, not in base table

    // Only delete updated_at for tables that have it (Supabase trigger sets it)
    if (!CREATED_AT_TABLES.has(table_name)) {
      delete result.updated_at
    }

    for (const key of Object.keys(result)) {
      // Convert Date objects to ISO strings
      if (result[key] instanceof Date) {
        result[key] = (result[key] as Date).toISOString()
      }
      // Remove null values so Supabase defaults can apply
      if (result[key] === null) {
        delete result[key]
      }
    }
    return result
  }

  private async save_to_local(table_name: SyncableTableName, cloud_item: Record<string, unknown>): Promise<void> {
    const local_item = { ...cloud_item }
    local_item.local_saved_at = SYNC_SENTINEL

    // For users table, ensure updated_at is set (RPC may return NULL if user never signed in)
    if (table_name === 'users' && !local_item.updated_at) {
      local_item.updated_at = local_item.created_at || new Date().toISOString()
    }

    const columns = Object.keys(local_item)
    const values = Object.values(local_item)
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const update_set = columns.map((col, i) => `${col} = $${i + 1}`).join(', ')

    // Handle special PKs
    const pk_columns = COMPOSITE_PK_TABLES[table_name]
    let conflict_target: string
    if (pk_columns) {
      conflict_target = `(${pk_columns.join(', ')})`
    } else {
      conflict_target = '(id)'
    }

    await this.local_pg.query(
      `INSERT INTO ${table_name} (${columns.join(', ')}) VALUES (${placeholders})
       ON CONFLICT ${conflict_target} DO UPDATE SET ${update_set}`,
      values,
    )
  }

  private async sync_deletes(synced_up_to: Date | null): Promise<{ pushed: number, pulled: number, errors: SyncError[] }> {
    const errors: SyncError[] = []
    let pushed = 0
    let pulled = 0

    // Step 1: Read local deletes FIRST (before pulling remote, to avoid pushing back what we pull)
    const local_deletes = await this.local_db.select().from(local_schema.deletes)

    // Step 2: Pull remote deletes
    const pull_result = await this.pull_remote_deletes(synced_up_to)
    pulled = pull_result.count
    errors.push(...pull_result.errors)

    // Step 3: Push local deletes (only the ones we read before pulling)
    if (local_deletes.length > 0) {
      const push_result = await this.push_local_deletes(local_deletes)
      pushed = push_result.count
      errors.push(...push_result.errors)
    }

    // Step 4: Clear local deletes table after both operations complete
    if (local_deletes.length > 0 || pulled > 0) {
      await this.local_db.delete(local_schema.deletes)
    }

    return { pushed, pulled, errors }
  }

  private async pull_remote_deletes(since: Date | null): Promise<{ count: number, errors: SyncError[] }> {
    const errors: SyncError[] = []

    let query = this.supabase
      .from('deletes' as any)
      .select('*')

    if (since) {
      query = query.gt('deleted_at', since.toISOString())
    }

    const { data, error } = await query
    if (error) {
      errors.push({ operation: 'delete_pull', table_name: 'deletes', id: '', error: error.message })
      return { count: 0, errors }
    }

    if (!data || data.length === 0) {
      return { count: 0, errors }
    }

    for (const remote_delete of data as any[]) {
      try {
        // Insert into local deletes table (trigger will cascade the delete)
        await this.local_pg.query(
          `INSERT INTO deletes (table_name, id, local_saved_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [remote_delete.table_name, remote_delete.id, SYNC_SENTINEL],
        )
      } catch (err) {
        errors.push({
          operation: 'delete_pull',
          table_name: remote_delete.table_name,
          id: remote_delete.id,
          error: String(err),
        })
      }
    }

    return { count: data.length, errors }
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
      errors.push({ operation: 'delete_push', table_name: 'user_deletes', id: '', error: error.message })
      return { count: 0, errors }
    }

    return { count: local_deletes.length, errors }
  }
}

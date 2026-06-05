/**
 * SQLite schema introspection — engine-agnostic.
 *
 * One `QueryFn` adapter accommodates both engines we care about:
 *   - better-sqlite3 (server): wrap `db.prepare(sql).all(params)` in an async fn.
 *   - wa-sqlite (browser, via `SqliteConnection.query`): already async, same shape.
 *
 * Output is a single `SchemaInfo` consumed by `/admin/schema/+page.svelte`.
 *
 * Notes on quirks:
 *   - Identifier interpolation is OK here because every name we splice in came
 *     out of `sqlite_master` (engine-validated). For belt-and-braces we wrap
 *     identifiers in double-quotes.
 *   - `PRAGMA index_list` doesn't expose the WHERE clause of partial indexes
 *     reliably across versions. We parse it out of `sqlite_master.sql` with a
 *     cheap regex instead; `partial_where` is `null` when not present.
 */

export interface SchemaInfo {
  source_label: string
  tables: TableInfo[]
  views: ViewInfo[]
  triggers: TriggerInfo[]
}

export interface TableInfo {
  name: string
  raw_sql: string
  columns: ColumnInfo[]
  primary_key_columns: string[]
  foreign_keys: ForeignKeyInfo[]
  indexes: TableIndexInfo[]
  triggers: TriggerInfo[]
  row_count: number | null
}

export interface ColumnInfo {
  name: string
  type: string
  not_null: boolean
  default_value: string | null
  pk_order: number
  is_unique: boolean
  is_foreign_key: boolean
}

export interface ForeignKeyInfo {
  column: string
  target_table: string
  target_column: string
  on_delete: string
  on_update: string
}

export interface TableIndexInfo {
  name: string
  unique: boolean
  columns: string[]
  partial_where: string | null
  origin: 'c' | 'u' | 'pk'
}

export interface TriggerInfo {
  name: string
  table_name: string
  raw_sql: string
}

export interface ViewInfo {
  name: string
  raw_sql: string
}

export type QueryFn = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>

interface MasterRow { name: string, sql: string | null, tbl_name?: string }
interface TableInfoRow { cid: number, name: string, type: string, notnull: number, dflt_value: string | null, pk: number }
interface ForeignKeyRow { id: number, seq: number, table: string, from: string, to: string | null, on_update: string, on_delete: string, match: string }
interface IndexListRow { seq: number, name: string, unique: number, origin: 'c' | 'u' | 'pk', partial: number }
interface IndexInfoRow { seqno: number, cid: number, name: string }

export interface IntrospectOptions {
  /** Skip `SELECT COUNT(*)` per table (faster, or required for ephemeral DBs). */
  skip_row_counts?: boolean
}

export async function introspect(query: QueryFn, source_label: string, options: IntrospectOptions = {}): Promise<SchemaInfo> {
  const skip_row_counts = options.skip_row_counts ?? false

  const table_rows = await query<MasterRow>(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  )
  const view_rows = await query<MasterRow>(
    `SELECT name, sql FROM sqlite_master WHERE type='view' ORDER BY name`,
  )
  const trigger_rows = await query<MasterRow>(
    `SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger' ORDER BY name`,
  )

  const triggers: TriggerInfo[] = trigger_rows.map(row => ({
    name: row.name,
    table_name: row.tbl_name ?? '',
    raw_sql: row.sql ?? '',
  }))

  const index_master_rows = await query<MasterRow>(
    `SELECT name, sql FROM sqlite_master WHERE type='index'`,
  )
  const index_sql_by_name = new Map<string, string | null>()
  for (const row of index_master_rows)
    index_sql_by_name.set(row.name, row.sql)

  const tables: TableInfo[] = []
  for (const table_row of table_rows) {
    const { name } = table_row
    const quoted = quote_identifier(name)

    const columns_raw = await query<TableInfoRow>(`PRAGMA table_info(${quoted})`)
    const fks_raw = await query<ForeignKeyRow>(`PRAGMA foreign_key_list(${quoted})`)
    const indexes_raw = await query<IndexListRow>(`PRAGMA index_list(${quoted})`)

    const indexes: TableIndexInfo[] = []
    for (const idx of indexes_raw) {
      const info_rows = await query<IndexInfoRow>(`PRAGMA index_info(${quote_identifier(idx.name)})`)
      const idx_sql = index_sql_by_name.get(idx.name) ?? null
      indexes.push({
        name: idx.name,
        unique: idx.unique === 1,
        columns: info_rows.sort((a, b) => a.seqno - b.seqno).map(row => row.name),
        partial_where: idx.partial === 1 ? parse_partial_where(idx_sql) : null,
        origin: idx.origin,
      })
    }

    const foreign_keys: ForeignKeyInfo[] = fks_raw.map(row => ({
      column: row.from,
      target_table: row.table,
      // `to` is null when the FK references the target's primary key without
      // naming the column. Resolve to the first PK column we can find, falling
      // back to `id` as a sane default.
      target_column: row.to ?? infer_pk_column(table_rows, row.table) ?? 'id',
      on_delete: row.on_delete,
      on_update: row.on_update,
    }))

    const fk_columns = new Set(foreign_keys.map(fk => fk.column))
    const unique_single_column_columns = new Set<string>()
    for (const idx of indexes) {
      if (idx.unique && idx.columns.length === 1 && idx.partial_where === null)
        unique_single_column_columns.add(idx.columns[0])
    }

    const columns: ColumnInfo[] = columns_raw.map(row => ({
      name: row.name,
      type: row.type,
      not_null: row.notnull === 1,
      default_value: row.dflt_value,
      pk_order: row.pk,
      is_unique: unique_single_column_columns.has(row.name),
      is_foreign_key: fk_columns.has(row.name),
    }))

    const primary_key_columns = columns_raw
      .filter(row => row.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map(row => row.name)

    let row_count: number | null = null
    if (!skip_row_counts) {
      const [count_row] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${quoted}`)
      row_count = count_row?.n ?? 0
    }

    const attached_triggers = triggers.filter(trigger => trigger.table_name === name)

    tables.push({
      name,
      raw_sql: table_row.sql ?? '',
      columns,
      primary_key_columns,
      foreign_keys,
      indexes,
      triggers: attached_triggers,
      row_count,
    })
  }

  const views: ViewInfo[] = view_rows.map(row => ({
    name: row.name,
    raw_sql: row.sql ?? '',
  }))

  return { source_label, tables, views, triggers }
}

function quote_identifier(identifier: string): string {
  // sqlite identifier quoting: wrap in double-quotes and double up any internal
  // double-quotes. Names from sqlite_master can't realistically contain them,
  // but cheap insurance for the paste-source path.
  return `"${identifier.replace(/"/g, '""')}"`
}

function parse_partial_where(sql: string | null): string | null {
  if (!sql)
    return null
  // Find the WHERE keyword and return everything after it. Using string ops
  // instead of a single regex avoids catastrophic-backtracking warnings on the
  // `\s+(.+?)\s*$` form (the two patterns overlap on whitespace).
  const where_match = sql.match(/\bWHERE\b/i)
  if (!where_match || where_match.index === undefined)
    return null
  const after = sql.slice(where_match.index + where_match[0].length).trim()
  return after || null
}

function infer_pk_column(table_rows: MasterRow[], target_table: string): string | null {
  const row = table_rows.find(r => r.name === target_table)
  if (!row?.sql)
    return null
  // Split the CREATE TABLE body on commas, pick the column entry containing
  // PRIMARY KEY, then read off the leading identifier. Simple-minded but
  // sufficient for the FK-display fallback (we only ever hit this when the FK
  // didn't name the target column explicitly).
  const open_paren = row.sql.indexOf('(')
  if (open_paren === -1)
    return null
  const inner = row.sql.slice(open_paren + 1)
  for (const part of inner.split(',')) {
    if (!/\bPRIMARY\s+KEY\b/i.test(part))
      continue
    const id_match = part.match(/^\s*"?([a-z_]\w*)/i)
    if (id_match)
      return id_match[1]
  }
  return null
}

if (import.meta.vitest) {
  const Database = (await import('better-sqlite3')).default

  function make_query(db: InstanceType<typeof Database>): QueryFn {
    return (sql, params) => Promise.resolve(db.prepare(sql).all(...(params ?? []) as unknown[]) as never)
  }

  describe(introspect, () => {
    it('captures simple columns + types + defaults', async () => {
      const db = new Database(':memory:')
      db.exec(`
        CREATE TABLE widgets (
          id TEXT PRIMARY KEY,
          label TEXT NOT NULL,
          count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )
      `)
      const info = await introspect(make_query(db), 'test')
      const widgets = info.tables.find(t => t.name === 'widgets')
      expect(widgets).toBeDefined()
      expect(widgets!.columns.map(c => c.name)).toEqual(['id', 'label', 'count', 'created_at'])
      expect(widgets!.columns.find(c => c.name === 'label')!.not_null).toBe(true)
      expect(widgets!.columns.find(c => c.name === 'count')!.default_value).toBe('0')
      expect(widgets!.columns.find(c => c.name === 'created_at')!.default_value)
        .toMatch(/strftime/)
      expect(widgets!.primary_key_columns).toEqual(['id'])
      expect(widgets!.row_count).toBe(0)
      db.close()
    })

    it('preserves composite primary key order', async () => {
      const db = new Database(':memory:')
      db.exec(`
        CREATE TABLE pivots (
          a TEXT NOT NULL,
          b TEXT NOT NULL,
          extra TEXT,
          PRIMARY KEY (b, a)
        )
      `)
      const info = await introspect(make_query(db), 'test')
      const pivots = info.tables.find(t => t.name === 'pivots')!
      expect(pivots.primary_key_columns).toEqual(['b', 'a'])
      db.close()
    })

    it('extracts FK with ON DELETE CASCADE', async () => {
      const db = new Database(':memory:')
      db.exec(`
        CREATE TABLE parent (id TEXT PRIMARY KEY);
        CREATE TABLE child (
          id TEXT PRIMARY KEY,
          parent_id TEXT NOT NULL REFERENCES parent(id) ON DELETE CASCADE
        );
      `)
      const info = await introspect(make_query(db), 'test')
      const child = info.tables.find(t => t.name === 'child')!
      expect(child.foreign_keys).toHaveLength(1)
      expect(child.foreign_keys[0]).toEqual({
        column: 'parent_id',
        target_table: 'parent',
        target_column: 'id',
        on_delete: 'CASCADE',
        on_update: 'NO ACTION',
      })
      expect(child.columns.find(c => c.name === 'parent_id')!.is_foreign_key).toBe(true)
    })

    it('marks single-column UNIQUE as is_unique, leaves composite UNIQUE alone', async () => {
      const db = new Database(':memory:')
      db.exec(`
        CREATE TABLE u (
          id TEXT PRIMARY KEY,
          slug TEXT UNIQUE,
          a TEXT,
          b TEXT,
          UNIQUE (a, b)
        )
      `)
      const info = await introspect(make_query(db), 'test')
      const u = info.tables.find(t => t.name === 'u')!
      expect(u.columns.find(c => c.name === 'slug')!.is_unique).toBe(true)
      expect(u.columns.find(c => c.name === 'a')!.is_unique).toBe(false)
      expect(u.columns.find(c => c.name === 'b')!.is_unique).toBe(false)
    })

    it('parses partial-index WHERE from sqlite_master.sql', async () => {
      const db = new Database(':memory:')
      db.exec(`
        CREATE TABLE posts (id TEXT PRIMARY KEY, deleted_at TEXT);
        CREATE INDEX idx_posts_active ON posts(id) WHERE deleted_at IS NULL;
      `)
      const info = await introspect(make_query(db), 'test')
      const posts = info.tables.find(t => t.name === 'posts')!
      const idx = posts.indexes.find(i => i.name === 'idx_posts_active')!
      expect(idx.partial_where).toBe('deleted_at IS NULL')
    })

    it('attaches triggers to their parent table', async () => {
      const db = new Database(':memory:')
      db.exec(`
        CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER);
        CREATE TRIGGER bump_n AFTER UPDATE ON t
        BEGIN
          UPDATE t SET n = n + 1 WHERE id = NEW.id;
        END;
      `)
      const info = await introspect(make_query(db), 'test')
      const t = info.tables.find(table => table.name === 't')!
      expect(t.triggers.map(tr => tr.name)).toEqual(['bump_n'])
      expect(info.triggers.map(tr => tr.name)).toEqual(['bump_n'])
    })

    it('counts rows by default; honors skip_row_counts', async () => {
      const db = new Database(':memory:')
      db.exec(`CREATE TABLE t (id TEXT PRIMARY KEY)`)
      db.prepare(`INSERT INTO t (id) VALUES (?)`).run('a')
      db.prepare(`INSERT INTO t (id) VALUES (?)`).run('b')
      const info_with = await introspect(make_query(db), 'test')
      expect(info_with.tables[0].row_count).toBe(2)
      const info_without = await introspect(make_query(db), 'test', { skip_row_counts: true })
      expect(info_without.tables[0].row_count).toBeNull()
    })

    it('captures views', async () => {
      const db = new Database(':memory:')
      db.exec(`
        CREATE TABLE t (id TEXT PRIMARY KEY);
        CREATE VIEW v AS SELECT id FROM t;
      `)
      const info = await introspect(make_query(db), 'test')
      expect(info.views.map(v => v.name)).toEqual(['v'])
      expect(info.views[0].raw_sql).toMatch(/SELECT id FROM t/i)
    })

    it('source_label is echoed through', async () => {
      const db = new Database(':memory:')
      const info = await introspect(make_query(db), 'pasted SQL')
      expect(info.source_label).toBe('pasted SQL')
    })
  })
}

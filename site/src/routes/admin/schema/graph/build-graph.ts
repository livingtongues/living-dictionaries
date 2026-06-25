/**
 * Pure helpers for the schema graph view.
 *
 * Splits two concerns from the Svelte component so they can be tested + reasoned
 * about independently:
 *   1. `is_junction_table` / `is_system_table` — heuristics for filter toggles.
 *   2. `build_graph` — turn a `SchemaInfo` + filter options into the
 *      `{ nodes, edges }` the canvas renders, with dagre auto-layout applied.
 *
 * Saved drag positions (passed in via `saved_positions`) win over dagre's
 * computed layout — so a user's tidied arrangement survives reloads.
 */
import dagre from 'dagre'
import type { ColumnInfo, SchemaInfo, TableInfo } from '$lib/db/introspect'

/** Bookkeeping columns we tolerate on junction/derived tables without disqualifying them. */
const SYSTEM_COLUMN_NAMES = new Set(['created_at', 'updated_at', 'deleted_at', 'dirty'])
/** Sort/index columns that are valid payload on a junction-like table. */
const ORDER_COLUMN_NAMES = new Set(['position', 'sort_order', 'rank'])

/** Tables hidden by the "hide system tables" toggle — cross-cutting infra,
 *  not domain entities. Spans both the server shared.db and the dictionary db. */
const SYSTEM_TABLE_NAMES = new Set([
  'migrations',
  'db_metadata',
  'deletes',
  'client_logs',
  'email_codes',
  'email_aliases',
])

export function is_system_table(name: string): boolean {
  return SYSTEM_TABLE_NAMES.has(name)
}

/**
 * A table's structural role for visualization purposes:
 *
 *   - `'junction'` — the standard sync-friendly join shape: single `id`
 *     PRIMARY KEY + ≥2 foreign keys + optional position/system columns. Used
 *     for `sense_photos`, `entry_tags`, `video_speakers`, etc. Has a stable
 *     per-row id so the sync engine can attribute tombstones.
 *
 *   - `'derived'` — composite-PK of (FK columns + optionally `position`) with
 *     no `id` column and no sync bookkeeping — a trigger-maintained projection
 *     of something else that already syncs. The lack of an id column is the
 *     whole point.
 *
 *   - `'regular'` — anything else (entities + 1-FK lookup tables).
 */
export type TableKind = 'junction' | 'derived' | 'regular'

export function classify_table(table: TableInfo): TableKind {
  if (is_junction_table(table)) return 'junction'
  if (is_derived_table(table)) return 'derived'
  return 'regular'
}

/**
 * Junction shape: single `id` PRIMARY KEY + ≥2 FKs + every other column is
 * either a known bookkeeping field (position, created_at, updated_at,
 * deleted_at, dirty) OR at most ONE "qualifier" payload column — and even
 * that one qualifier is only tolerated when an order column is present.
 *
 * The order-column requirement is what separates a true junction-with-qualifier
 * from an entity that just happens to have ≥2 FKs. Entities don't generally
 * need an explicit ordering column inside themselves; junctions do, because the
 * parent cares about the order of its joined items.
 */
export function is_junction_table(table: TableInfo): boolean {
  if (table.foreign_keys.length < 2)
    return false
  if (table.primary_key_columns.length !== 1 || table.primary_key_columns[0] !== 'id')
    return false
  const fk_cols = new Set(table.foreign_keys.map(fk => fk.column))
  let qualifier_count = 0
  let has_order_column = false
  for (const col of table.columns) {
    if (col.name === 'id') continue
    if (fk_cols.has(col.name)) continue
    if (ORDER_COLUMN_NAMES.has(col.name)) {
      has_order_column = true
      continue
    }
    if (SYSTEM_COLUMN_NAMES.has(col.name)) continue
    qualifier_count++
  }
  if (qualifier_count === 0) return true
  if (qualifier_count === 1 && has_order_column) return true
  return false
}

/**
 * Derived (trigger-maintained projection) shape: composite PK comprising
 * only FK columns and/or an order column, with no `id` and no sync bookkeeping.
 */
export function is_derived_table(table: TableInfo): boolean {
  if (table.foreign_keys.length < 2) return false
  if (table.primary_key_columns.length < 2) return false
  if (table.columns.some(col => col.name === 'id')) return false
  const fk_cols = new Set(table.foreign_keys.map(fk => fk.column))
  // Every PK column is either an FK or an order column.
  for (const pk_col of table.primary_key_columns) {
    if (fk_cols.has(pk_col)) continue
    if (ORDER_COLUMN_NAMES.has(pk_col)) continue
    return false
  }
  // No non-PK columns allowed (no payload, no sync metadata).
  for (const col of table.columns) {
    if (!table.primary_key_columns.includes(col.name))
      return false
  }
  return true
}

export interface GraphFilters {
  hide_junctions: boolean
  hide_system: boolean
  /** Manually-hidden table names (from right-click hide). */
  hidden: Set<string>
}

export interface GraphNodeData extends Record<string, unknown> {
  table: TableInfo
  kind: TableKind
}

export interface GraphNode {
  id: string
  type: 'table'
  position: { x: number, y: number }
  data: GraphNodeData
  width: number
  height: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
  data: {
    on_delete: string
    column: string
    target_column: string
  }
}

export interface BuildGraphResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  visible_count: number
  hidden_count: number
}

export type SavedPositions = Record<string, { x: number, y: number }>

export interface BuildGraphOptions {
  filters: GraphFilters
  saved_positions?: SavedPositions
}

/**
 * Estimate node dimensions from column count — dagre needs box sizes up-front to
 * compute a non-overlapping layout. Roughly matches `table-node.svelte`'s CSS.
 */
function estimate_size(table: TableInfo): { width: number, height: number } {
  const header_height = 36
  const row_height = 22
  const footer_padding = 12
  const visible_rows = Math.min(table.columns.length, 18)
  return {
    width: 260,
    height: header_height + footer_padding + (visible_rows * row_height),
  }
}

/**
 * Focused view: anchor table on the left, every directly-connected table
 * stacked in a middle column. When a neighbor is a JUNCTION or DERIVED table,
 * the OTHER endpoint of that junction appears in a third column on the right,
 * vertically aligned with its junction — so the reader can see the full path
 * `focused → junction → other-side` in one glance.
 *
 * Connections counted in BOTH directions — outgoing FKs (this table → parent)
 * AND incoming FKs (children → this table). The layout is hand-rolled rather
 * than dagre — the geometry is trivial and the spatial metaphor (focus = left,
 * neighbors = middle, junction-other-end = right) IS the affordance.
 */
export function build_focused_graph(schema: SchemaInfo, focused_name: string): BuildGraphResult {
  const focused = schema.tables.find(t => t.name === focused_name)
  if (!focused) {
    return { nodes: [], edges: [], visible_count: 0, hidden_count: 0 }
  }

  const related_names = new Set<string>()
  // Outgoing FKs — tables this table points at.
  for (const fk of focused.foreign_keys) {
    if (fk.target_table !== focused_name)
      related_names.add(fk.target_table)
  }
  // Incoming FKs — tables that point at this one.
  for (const table of schema.tables) {
    if (table.name === focused_name) continue
    if (table.foreign_keys.some(fk => fk.target_table === focused_name))
      related_names.add(table.name)
  }

  const related_tables = schema.tables.filter(t => related_names.has(t.name))

  // For each junction/derived neighbor, find its "other end" — the FK target
  // that ISN'T the focused table. May be undefined (self-join, or already-
  // shown table). Captured per-neighbor so we can place each other-end node
  // vertically aligned with its junction.
  function other_end_of_junction(junction: TableInfo): TableInfo | undefined {
    const kind = classify_table(junction)
    if (kind !== 'junction' && kind !== 'derived') return undefined
    for (const fk of junction.foreign_keys) {
      if (fk.target_table === focused_name) continue
      if (fk.target_table === junction.name) continue
      const target = schema.tables.find(t => t.name === fk.target_table)
      if (target) return target
    }
    return undefined
  }

  // Map neighbor name → (optional) other-end TableInfo. Sharing a name across
  // multiple junctions is fine; we'll still render one third-column node per
  // unique name, vertically aligned with the first junction that names it.
  const neighbor_other_ends = new Map<string, TableInfo | undefined>()
  for (const neighbor of related_tables)
    neighbor_other_ends.set(neighbor.name, other_end_of_junction(neighbor))

  // Layout.
  const focus_size = estimate_size(focused)
  const focus_x = 0
  const focus_y = 0
  const column_gap = 280
  const satellite_gap = 40

  const satellite_sizes = related_tables.map(estimate_size)
  const total_satellite_height = satellite_sizes.reduce((sum, size) => sum + size.height, 0)
    + Math.max(0, related_tables.length - 1) * satellite_gap
  const satellite_x = focus_size.width + column_gap
  let satellite_y = focus_y + (focus_size.height / 2) - (total_satellite_height / 2)

  // Widest satellite governs where the third column begins.
  const widest_satellite = satellite_sizes.reduce((max, size) => Math.max(max, size.width), 0)
  const third_col_x = satellite_x + widest_satellite + column_gap

  const visible_names = new Set([focused_name, ...related_names])
  const nodes: GraphNode[] = []

  // Anchor (column 1).
  nodes.push({
    id: focused.name,
    type: 'table',
    position: { x: focus_x, y: focus_y },
    data: { table: focused, kind: classify_table(focused) },
    width: focus_size.width,
    height: focus_size.height,
  })

  // Track third-column placements so multiple junctions sharing an other-end
  // collapse to a single node (placed next to the first junction that names it).
  const third_column_placed = new Map<string, { x: number, y: number }>()

  // Satellites (column 2) + their junction-other-ends (column 3).
  for (let satellite_index = 0; satellite_index < related_tables.length; satellite_index++) {
    const table = related_tables[satellite_index]
    const size = satellite_sizes[satellite_index]
    nodes.push({
      id: table.name,
      type: 'table',
      position: { x: satellite_x, y: satellite_y },
      data: { table, kind: classify_table(table) },
      width: size.width,
      height: size.height,
    })

    const other_end = neighbor_other_ends.get(table.name)
    if (other_end && other_end.name !== focused_name && !third_column_placed.has(other_end.name)) {
      const other_size = estimate_size(other_end)
      // Center the other-end vertically against this junction's center.
      const other_y = satellite_y + (size.height / 2) - (other_size.height / 2)
      nodes.push({
        id: other_end.name,
        type: 'table',
        position: { x: third_col_x, y: other_y },
        data: { table: other_end, kind: classify_table(other_end) },
        width: other_size.width,
        height: other_size.height,
      })
      third_column_placed.set(other_end.name, { x: third_col_x, y: other_y })
      visible_names.add(other_end.name)
    }

    satellite_y += size.height + satellite_gap
  }

  // Edges — keep anything touching the focused node OR connecting a satellite
  // to its placed third-column other-end. Satellite-to-satellite chatter (e.g.
  // a junction's FK to a table that's also a direct neighbor of focused) is
  // still excluded to keep the path-of-three visually clean.
  const edges: GraphEdge[] = []
  const placed_third_column_names = new Set(third_column_placed.keys())
  for (const table of nodes.map(n => n.data.table)) {
    for (const fk of table.foreign_keys) {
      if (!visible_names.has(fk.target_table)) continue
      const touches_focus = table.name === focused_name || fk.target_table === focused_name
      const is_satellite_to_third_col
        = related_names.has(table.name) && placed_third_column_names.has(fk.target_table)
      if (!touches_focus && !is_satellite_to_third_col) continue
      edges.push({
        id: `${table.name}.${fk.column}->${fk.target_table}.${fk.target_column}`,
        source: table.name,
        target: fk.target_table,
        data: {
          on_delete: fk.on_delete,
          column: fk.column,
          target_column: fk.target_column,
        },
      })
    }
  }

  return {
    nodes,
    edges,
    visible_count: nodes.length,
    hidden_count: schema.tables.length - nodes.length,
  }
}

export function build_graph(schema: SchemaInfo, options: BuildGraphOptions): BuildGraphResult {
  const { filters, saved_positions = {} } = options

  const all_tables = schema.tables
  const total = all_tables.length

  const visible_tables = all_tables.filter((table) => {
    if (filters.hidden.has(table.name))
      return false
    if (filters.hide_system && is_system_table(table.name))
      return false
    if (filters.hide_junctions && is_junction_table(table))
      return false
    return true
  })

  const visible_names = new Set(visible_tables.map(t => t.name))

  // Build dagre graph for layout. Left-to-right layered DAG reads well for
  // entity diagrams; nodesep/ranksep tuned for the compact node size.
  const dagre_graph = new dagre.graphlib.Graph()
  dagre_graph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 90, marginx: 40, marginy: 40 })
  dagre_graph.setDefaultEdgeLabel(() => ({}))

  for (const table of visible_tables) {
    const size = estimate_size(table)
    dagre_graph.setNode(table.name, { width: size.width, height: size.height })
  }

  const edges: GraphEdge[] = []
  for (const table of visible_tables) {
    for (const fk of table.foreign_keys) {
      if (!visible_names.has(fk.target_table))
        continue
      const edge_id = `${table.name}.${fk.column}->${fk.target_table}.${fk.target_column}`
      edges.push({
        id: edge_id,
        source: table.name,
        target: fk.target_table,
        data: {
          on_delete: fk.on_delete,
          column: fk.column,
          target_column: fk.target_column,
        },
      })
      dagre_graph.setEdge(table.name, fk.target_table)
    }
  }

  dagre.layout(dagre_graph)

  const nodes: GraphNode[] = visible_tables.map((table) => {
    const dagre_node = dagre_graph.node(table.name)
    const size = estimate_size(table)
    // dagre returns the center of the box; the canvas positions by top-left.
    const computed_x = dagre_node.x - size.width / 2
    const computed_y = dagre_node.y - size.height / 2
    const saved = saved_positions[table.name]
    return {
      id: table.name,
      type: 'table',
      position: saved ?? { x: computed_x, y: computed_y },
      data: { table, kind: classify_table(table) },
      width: size.width,
      height: size.height,
    }
  })

  return {
    nodes,
    edges,
    visible_count: visible_tables.length,
    hidden_count: total - visible_tables.length,
  }
}

if (import.meta.vitest) {
  function table(name: string, opts: Partial<TableInfo> = {}): TableInfo {
    return {
      name,
      raw_sql: '',
      columns: [],
      primary_key_columns: [],
      foreign_keys: [],
      indexes: [],
      triggers: [],
      row_count: null,
      ...opts,
    }
  }

  // Helpers for shorthand column construction.
  function col(name: string, opts: Partial<ColumnInfo> = {}): ColumnInfo {
    return { name, type: 'TEXT', not_null: false, default_value: null, pk_order: 0, is_unique: false, is_foreign_key: false, ...opts }
  }
  function pk_col(name: string, pk_order = 1): ColumnInfo {
    return col(name, { pk_order, not_null: true })
  }
  function fk_col(name: string, pk_order = 0): ColumnInfo {
    return col(name, { pk_order, is_foreign_key: true, not_null: true })
  }
  function pk_fk_col(name: string, pk_order: number): ColumnInfo {
    return col(name, { pk_order, is_foreign_key: true, not_null: true })
  }

  describe(is_junction_table, () => {
    it('detects id-PK + 2 FK junction (sense_photos shape)', () => {
      const t = table('sense_photos', {
        primary_key_columns: ['id'],
        foreign_keys: [
          { column: 'sense_id', target_table: 'senses', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          { column: 'photo_id', target_table: 'photos', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        ],
        columns: [
          pk_col('id'),
          fk_col('sense_id'),
          fk_col('photo_id'),
          col('position', { type: 'INTEGER', not_null: true }),
          col('dirty', { type: 'INTEGER' }),
          col('created_at', { not_null: true }),
          col('updated_at', { not_null: true }),
        ],
      })
      expect(is_junction_table(t)).toBe(true)
      expect(is_derived_table(t)).toBe(false)
      expect(classify_table(t)).toBe('junction')
    })

    it('accepts ONE qualifier payload column when an order column is present', () => {
      const t = table('entry_dialects', {
        primary_key_columns: ['id'],
        foreign_keys: [
          { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          { column: 'dialect_id', target_table: 'dialects', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        ],
        columns: [
          pk_col('id'),
          fk_col('entry_id'),
          fk_col('dialect_id'),
          col('note', { not_null: true }),
          col('position', { type: 'INTEGER', not_null: true }),
          col('dirty', { type: 'INTEGER' }),
          col('created_at', { not_null: true }),
          col('updated_at', { not_null: true }),
        ],
      })
      expect(is_junction_table(t)).toBe(true)
      expect(classify_table(t)).toBe('junction')
    })

    it('rejects entity-with-FKs (id + 2 FKs + body, no order column)', () => {
      const t = table('comments', {
        primary_key_columns: ['id'],
        foreign_keys: [
          { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          { column: 'author_id', target_table: 'users', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        ],
        columns: [pk_col('id'), fk_col('entry_id'), fk_col('author_id'), col('body', { not_null: true })],
      })
      expect(is_junction_table(t)).toBe(false)
      expect(classify_table(t)).toBe('regular')
    })

    it('rejects junction-shaped tables with TWO+ payload columns (entity territory)', () => {
      const t = table('memberships', {
        primary_key_columns: ['id'],
        foreign_keys: [
          { column: 'user_id', target_table: 'users', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          { column: 'group_id', target_table: 'groups', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        ],
        columns: [
          pk_col('id'),
          fk_col('user_id'),
          fk_col('group_id'),
          col('role', { not_null: true }),
          col('expires_at'),
        ],
      })
      expect(is_junction_table(t)).toBe(false)
    })

    it('rejects a 1-FK table', () => {
      const t = table('senses', {
        primary_key_columns: ['id'],
        foreign_keys: [
          { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        ],
        columns: [pk_col('id'), fk_col('entry_id')],
      })
      expect(is_junction_table(t)).toBe(false)
    })
  })

  describe(is_derived_table, () => {
    it('detects composite PK of (FK, FK, position)', () => {
      const t = table('entry_image_embeds', {
        primary_key_columns: ['entry_id', 'image_id', 'position'],
        foreign_keys: [
          { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          { column: 'image_id', target_table: 'photos', target_column: 'id', on_delete: 'NO ACTION', on_update: 'NO ACTION' },
        ],
        columns: [pk_fk_col('entry_id', 1), pk_fk_col('image_id', 2), pk_col('position', 3)],
      })
      expect(is_derived_table(t)).toBe(true)
      expect(is_junction_table(t)).toBe(false)
      expect(classify_table(t)).toBe('derived')
    })

    it('detects bare 2-FK composite PK (simplest derived shape)', () => {
      const t = table('entry_topics', {
        primary_key_columns: ['entry_id', 'topic_id'],
        foreign_keys: [
          { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          { column: 'topic_id', target_table: 'topics', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        ],
        columns: [pk_fk_col('entry_id', 1), pk_fk_col('topic_id', 2)],
      })
      expect(is_derived_table(t)).toBe(true)
    })

    it('rejects derived shape if any non-PK column exists', () => {
      const t = table('entry_topics_with_payload', {
        primary_key_columns: ['entry_id', 'topic_id'],
        foreign_keys: [
          { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          { column: 'topic_id', target_table: 'topics', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        ],
        columns: [pk_fk_col('entry_id', 1), pk_fk_col('topic_id', 2), col('created_at')],
      })
      expect(is_derived_table(t)).toBe(false)
    })

    it('rejects tables with an `id` column (those are junction or regular)', () => {
      const t = table('sense_photos', {
        primary_key_columns: ['id'],
        foreign_keys: [
          { column: 'sense_id', target_table: 'senses', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          { column: 'photo_id', target_table: 'photos', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
        ],
        columns: [pk_col('id'), fk_col('sense_id'), fk_col('photo_id'), col('position')],
      })
      expect(is_derived_table(t)).toBe(false)
    })
  })

  describe(classify_table, () => {
    it('returns "regular" for an entity table', () => {
      const t = table('entries', {
        primary_key_columns: ['id'],
        columns: [pk_col('id'), col('lexeme'), col('phonetic')],
      })
      expect(classify_table(t)).toBe('regular')
    })
  })

  describe(is_system_table, () => {
    it('flags cross-cutting infra tables', () => {
      for (const name of ['migrations', 'db_metadata', 'deletes', 'client_logs', 'email_codes', 'email_aliases'])
        expect(is_system_table(name)).toBe(true)
    })
    it('does not flag domain tables', () => {
      for (const name of ['entries', 'senses', 'photos', 'dictionaries', 'users', 'messages'])
        expect(is_system_table(name)).toBe(false)
    })
  })

  describe(build_graph, () => {
    // Test schema: a junction (id-PK shape) glues entries ↔ tags.
    const schema: SchemaInfo = {
      source_label: 'test',
      tables: [
        table('dictionaries', {
          primary_key_columns: ['id'],
          columns: [pk_col('id')],
        }),
        table('entries', {
          primary_key_columns: ['id'],
          foreign_keys: [{ column: 'dictionary_id', target_table: 'dictionaries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' }],
          columns: [pk_col('id'), fk_col('dictionary_id')],
        }),
        table('tags', {
          primary_key_columns: ['id'],
          columns: [pk_col('id')],
        }),
        table('entry_tags', {
          primary_key_columns: ['id'],
          foreign_keys: [
            { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
            { column: 'tag_id', target_table: 'tags', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          ],
          columns: [
            pk_col('id'),
            fk_col('entry_id'),
            fk_col('tag_id'),
            col('position', { type: 'INTEGER', not_null: true }),
            col('dirty', { type: 'INTEGER' }),
            col('created_at', { not_null: true }),
            col('updated_at', { not_null: true }),
          ],
        }),
        table('migrations', {
          primary_key_columns: ['id'],
          columns: [pk_col('id')],
        }),
      ],
      views: [],
      triggers: [],
    }

    it('returns all tables + edges when nothing is filtered', () => {
      const out = build_graph(schema, { filters: { hide_junctions: false, hide_system: false, hidden: new Set() } })
      expect(out.visible_count).toBe(5)
      expect(out.hidden_count).toBe(0)
      expect(out.nodes.map(n => n.id).sort()).toEqual(['dictionaries', 'entries', 'entry_tags', 'migrations', 'tags'])
      // 3 FK edges: entries.dictionary_id→dictionaries, entry_tags.entry_id→entries, entry_tags.tag_id→tags
      expect(out.edges).toHaveLength(3)
    })

    it('hides system tables when hide_system is true', () => {
      const out = build_graph(schema, { filters: { hide_junctions: false, hide_system: true, hidden: new Set() } })
      expect(out.nodes.find(n => n.id === 'migrations')).toBeUndefined()
      expect(out.visible_count).toBe(4)
      expect(out.hidden_count).toBe(1)
    })

    it('hides junctions when hide_junctions is true', () => {
      const out = build_graph(schema, { filters: { hide_junctions: true, hide_system: false, hidden: new Set() } })
      expect(out.nodes.find(n => n.id === 'entry_tags')).toBeUndefined()
      // The 2 edges incident to entry_tags drop out; only entries→dictionaries remains.
      expect(out.edges).toHaveLength(1)
      expect(out.edges[0].source).toBe('entries')
      expect(out.edges[0].target).toBe('dictionaries')
    })

    it('node data carries the classified kind', () => {
      const out = build_graph(schema, { filters: { hide_junctions: false, hide_system: false, hidden: new Set() } })
      const entry_tags = out.nodes.find(n => n.id === 'entry_tags')!
      const dictionaries = out.nodes.find(n => n.id === 'dictionaries')!
      expect(entry_tags.data.kind).toBe('junction')
      expect(dictionaries.data.kind).toBe('regular')
    })

    it('honors the manually-hidden set', () => {
      const out = build_graph(schema, {
        filters: { hide_junctions: false, hide_system: false, hidden: new Set(['tags']) },
      })
      expect(out.nodes.find(n => n.id === 'tags')).toBeUndefined()
      expect(out.edges.find(e => e.target === 'tags')).toBeUndefined()
    })

    it('drops edges whose target is filtered out', () => {
      const out = build_graph(schema, { filters: { hide_junctions: false, hide_system: false, hidden: new Set(['dictionaries']) } })
      expect(out.edges.find(e => e.target === 'dictionaries')).toBeUndefined()
    })

    it('saved positions win over dagre layout', () => {
      const saved = { dictionaries: { x: 999, y: 888 } }
      const out = build_graph(schema, {
        filters: { hide_junctions: false, hide_system: false, hidden: new Set() },
        saved_positions: saved,
      })
      const dictionaries = out.nodes.find(n => n.id === 'dictionaries')!
      expect(dictionaries.position).toEqual({ x: 999, y: 888 })
    })
  })

  describe(build_focused_graph, () => {
    // Schema with: dictionaries — entries (direct FK), and a JUNCTION `entry_tags`
    // wiring entries ↔ tags, so focusing on entries should reveal tags in
    // the third column via the junction.
    const schema: SchemaInfo = {
      source_label: 'test',
      tables: [
        table('dictionaries', {
          primary_key_columns: ['id'],
          columns: [pk_col('id')],
        }),
        table('entries', {
          primary_key_columns: ['id'],
          foreign_keys: [{ column: 'dictionary_id', target_table: 'dictionaries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' }],
          columns: [pk_col('id'), fk_col('dictionary_id')],
        }),
        table('tags', {
          primary_key_columns: ['id'],
          columns: [pk_col('id')],
        }),
        table('entry_tags', {
          primary_key_columns: ['id'],
          foreign_keys: [
            { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
            { column: 'tag_id', target_table: 'tags', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          ],
          columns: [pk_col('id'), fk_col('entry_id'), fk_col('tag_id'), col('position', { type: 'INTEGER', not_null: true })],
        }),
        table('senses', {
          primary_key_columns: ['id'],
          foreign_keys: [
            { column: 'entry_id', target_table: 'entries', target_column: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
          ],
          columns: [pk_col('id'), fk_col('entry_id'), col('glosses', { not_null: true })],
        }),
        table('unrelated', { primary_key_columns: ['id'], columns: [pk_col('id')] }),
      ],
      views: [],
      triggers: [],
    }

    it('includes the focused table plus both inbound and outbound neighbors', () => {
      const out = build_focused_graph(schema, 'dictionaries')
      // dictionaries + entries (inbound FK from entries.dictionary_id).
      expect(out.nodes.map(n => n.id).sort()).toEqual(['dictionaries', 'entries'])
    })

    it('focused node sits at x=0, satellites at a higher x', () => {
      const out = build_focused_graph(schema, 'dictionaries')
      const dictionaries = out.nodes.find(n => n.id === 'dictionaries')!
      const entries = out.nodes.find(n => n.id === 'entries')!
      expect(dictionaries.position.x).toBe(0)
      expect(entries.position.x).toBeGreaterThan(dictionaries.position.x)
    })

    it('adds the junction other-end to a third column when neighbor is a JUNCTION', () => {
      // Focus on entries: direct neighbors include dictionaries (regular), senses
      // (regular), and entry_tags (junction). The junction's other end is `tags`
      // → should appear in the third column.
      const out = build_focused_graph(schema, 'entries')
      const tags = out.nodes.find(n => n.id === 'tags')
      expect(tags).toBeDefined()
      const entry_tags = out.nodes.find(n => n.id === 'entry_tags')!
      expect(tags!.position.x).toBeGreaterThan(entry_tags.position.x)
    })

    it('renders the junction → other-end edge so the path entries→entry_tags→tags is visible', () => {
      const out = build_focused_graph(schema, 'entries')
      const has_junction_to_other_end = out.edges.some(
        e => e.source === 'entry_tags' && e.target === 'tags',
      )
      expect(has_junction_to_other_end).toBe(true)
    })

    it('node kinds are classified on every focused-view node', () => {
      const out = build_focused_graph(schema, 'entries')
      expect(out.nodes.find(n => n.id === 'entry_tags')!.data.kind).toBe('junction')
      expect(out.nodes.find(n => n.id === 'tags')!.data.kind).toBe('regular')
    })

    it('returns empty result when focusing an unknown table', () => {
      const out = build_focused_graph(schema, 'nonexistent')
      expect(out.nodes).toHaveLength(0)
      expect(out.edges).toHaveLength(0)
    })
  })
}

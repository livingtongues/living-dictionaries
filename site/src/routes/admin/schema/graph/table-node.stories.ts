import type { TableInfo } from '$lib/db/introspect'
import type { Story, StoryMeta } from 'svelte-look'
import type Component from './table-node.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 300, height: 280 }],
  flavors: false,
}

const entries: TableInfo = {
  name: 'entries',
  raw_sql: '',
  columns: [
    { name: 'id', type: 'TEXT', not_null: true, default_value: null, pk_order: 1, is_unique: false, is_foreign_key: false },
    { name: 'lexeme', type: 'TEXT', not_null: true, default_value: null, pk_order: 0, is_unique: false, is_foreign_key: false },
    { name: 'phonetic', type: 'TEXT', not_null: false, default_value: null, pk_order: 0, is_unique: false, is_foreign_key: false },
    { name: 'dialect_id', type: 'TEXT', not_null: false, default_value: null, pk_order: 0, is_unique: false, is_foreign_key: true },
  ],
  primary_key_columns: ['id'],
  foreign_keys: [
    { column: 'dialect_id', target_table: 'dialects', target_column: 'id', on_delete: 'SET NULL', on_update: 'NO ACTION' },
  ],
  indexes: [],
  triggers: [],
  row_count: 4821,
}

export const Regular: Story<typeof Component> = {
  props: { table: entries, kind: 'regular' },
}

export const Selected: Story<typeof Component> = {
  props: { table: entries, kind: 'regular', selected: true },
}

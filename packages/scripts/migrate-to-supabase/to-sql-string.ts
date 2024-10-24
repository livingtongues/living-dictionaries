import type { Database, TablesInsert } from '@living-dictionaries/types'
import { convert_to_sql_string } from '../../site/src/lib/mocks/seed/to-sql-string'

export function sql_file_string<Table extends keyof Database['public']['Tables']>(table_name: Table, row: TablesInsert<Table>, operation: 'INSERT' | 'UPSERT' = 'INSERT') {
  const column_names = Object.keys(row).sort()
  const column_names_string = `"${column_names.join('", "')}"`

  const values = column_names.map(column => convert_to_sql_string(row[column]))
  const values_string = `(${values.join(', ')})`
  if (operation === 'INSERT') {
    return `INSERT INTO ${table_name} (${column_names_string}) VALUES\n${values_string};`
  } else if (operation === 'UPSERT') {
    return `INSERT INTO ${table_name} (${column_names_string}) VALUES\n${values_string}\nON CONFLICT (id) DO UPDATE SET ${column_names.map(column => `"${column}" = EXCLUDED."${column}"`).join(', ')};`
  }
}

import type { Database } from '@living-dictionaries/types'

function escape_arrays_properly(value: any[]) {
  return `'{${value
    .filter(v => v || v === 0)
    .map((v) => {
      if (typeof v === 'string' && (v.includes('"') || v.includes('\'') || v.includes(','))) {
        return `"${v.toString().replace(/"/g, '\\"').replace(/'/g, '\'\'')}"`
      }
      return v
    })
    .join(',')}}'`
}
// return `'{${value.filter(v => v || v === 0).join(',').replace(/"/g, '\\"').replace(/'/g, '\'\'')}}'`

export function convert_to_sql_string(value: string | number | object) {
  if (typeof value === 'boolean')
    return `${value}`
  if (typeof value === 'string')
    return `'${value.replace(/'/g, '\'\'')}'` // Escape single quotes // TODO, check if quotes need to be escaped
  if (typeof value === 'number')
    return `${value}`
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object')
      return `'{${value.map(item => `"${JSON.stringify(item).replace(/"/g, '\\"').replace(/'/g, '\'\'')}"`).join(',')}}'::jsonb[]`
    return escape_arrays_properly(value)
  }
  if (!value) // must come here to avoid snatching up 0, empty string, or false, but not after object
    return 'null'
  if (typeof value === 'object')
    return `'${JSON.stringify(value).replace(/'/g, '\'\'')}'::jsonb`
  throw new Error(`${value} has an unexpected value type: ${typeof value}`)
}

if (import.meta.vitest) {
  test(convert_to_sql_string, () => {
    expect(convert_to_sql_string([
      'Smith, John',
      'Photo credit: "Corn" by Jim',
    ])).toEqual('\'{"Smith, John","Photo credit: \\"Corn\\" by Jim"}\'')
  })
}

export function sql_file_string(table_name: keyof Database['public']['Tables'] | 'auth.users', rows: {
  id?: number | string
  [key: string]: any
}[], operation: 'INSERT' | 'UPSERT' | 'UPDATE' = 'INSERT') {
  const column_names = Object.keys(rows[0]).sort()
  const column_names_string = `"${column_names.join('", "')}"`

  if (operation === 'INSERT' || operation === 'UPSERT') {
    const values_string = rows.map((row) => {
      const values = column_names.map(column => convert_to_sql_string(row[column]))
      return `(${values.join(', ')})`
    }).join(',\n')

    if (operation === 'INSERT') {
      return `INSERT INTO ${table_name} (${column_names_string}) VALUES\n${values_string};`
    } else if (operation === 'UPSERT') {
      return `INSERT INTO ${table_name} (${column_names_string}) VALUES\n${values_string}\nON CONFLICT (id) DO UPDATE SET ${column_names.map(column => `"${column}" = EXCLUDED."${column}"`).join(', ')};`
    }
  } else if (operation === 'UPDATE') {
    const update_statements = rows.map((row) => {
      const set_clause = column_names.map(column => `"${column}" = ${convert_to_sql_string(row[column])}`).join(', ')
      const where_clause = `"id" = ${convert_to_sql_string(row.id)}`
      return `UPDATE ${table_name} SET ${set_clause} WHERE ${where_clause};`
    }).join('\n')

    return update_statements
  }
}

if (import.meta.vitest) {
  test(sql_file_string, () => {
    const everything_mock = [
      {
        text: 'hello',
        boolean: true,
        real: 12.4,
        int: 2,
        array: [1, 2],
        array_with_quotes: ['it\'s ok', 'it, was a "hot" day'],
        array_with_empty: ['', 'only I and 0 survive', 0, null],
        jsonb: {
          a: {
            b: 1,
            has_quotes: '\'its',
          },
        },
        jsonb_array: [
          {
            a: {
              b: 'it\'s',
            },
          },
        ],
      },
      {
        real: 12.4,
        boolean: false,
        text: '', // order of keys doesn't matter
        int: 0,
        array: [],
        jsonb: {
          array: [],
        },
      },
      {
      },
    ]
    expect(sql_file_string('everything' as 'entry_updates', everything_mock)).toMatchFileSnapshot('./to-sql-string.test.sql')
  })
}

import type { Database } from '@living-dictionaries/types'

function convert_to_sql_string(value: string | number | object) {
  if (typeof value === 'boolean')
    return `${value}`
  if (typeof value === 'string')
    return `'${value.replace(/'/g, '\'\'')}'` // Escape single quotes
  if (typeof value === 'number')
    return `${value}`
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object')
      return `'{${value.map(item => `"${JSON.stringify(item).replace(/"/g, '\\"').replace(/'/g, '\'\'')}"`).join(',')}}'::jsonb[]`
    return `'{${value.join(',')}}'`
  }
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object')
      return `'[${value.map(item => JSON.stringify(item)).join(',').replace(/'/g, '\'\'')}]'`
    return `'{${value.join(',')}}'`
  }
  if (!value) // must come here to avoid snatching up 0, empty string, or false, but not after object
    return 'null'
  if (typeof value === 'object')
    return `'${JSON.stringify(value)}'::jsonb`
  throw new Error(`${value} has an unexpected value type: ${typeof value}`)
}

export function sql_file_string(table_name: keyof Database['public']['Tables'] | 'auth.users', rows: object[]) {
  const column_names = Object.keys(rows[0]).sort()
  const column_names_string = `"${column_names.join('", "')}"`

  const values_string = rows.map((row) => {
    const values = column_names.map(column => convert_to_sql_string(row[column]))
    return `(${values.join(', ')})`
  }).join(',\n')

  return `INSERT INTO ${table_name} (${column_names_string}) VALUES\n${values_string};`
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
        jsonb: {
          a: {
            b: 1,
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

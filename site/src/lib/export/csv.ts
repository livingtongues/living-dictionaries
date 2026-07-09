import { download_blob } from './download-blob'

export function download_objects_as_csv(headers: Record<string, any>, items: Record<string, any>[], title: string) {
  const csv = objects_to_csv_by_headers(headers, items)
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  download_blob(blob, title, '.csv')
}

export function objects_to_csv_by_headers(headers: Record<string, any>, items: Record<string, any>[]): string {
  const helperRow = Object.values(headers).map(turnValueIntoStringSurroundWithQuotesAsNeeded).join(',')
  const headerKeys = Object.keys(headers)
  const itemRows = items
    .map((row) => {
      return headerKeys.map(key => turnValueIntoStringSurroundWithQuotesAsNeeded(row[key])).join(',')
    })

  return [headerKeys, helperRow, ...itemRows].join('\n')
}

function turnValueIntoStringSurroundWithQuotesAsNeeded(value: any) {
  if (value === null || value === undefined) return ''
  // eslint-disable-next-line unicorn/prefer-number-properties
  if (isNaN(value) && (value.includes(',') || value.includes('"')))
    return `"${value.replace(/"/g, '""')}"`
  return value
}

if (import.meta.vitest) {
  describe('objects_to_csv_by_headers', () => {
    const headers = {
      name: 'Name',
      age: 'Age',
      city: 'City',
    }

    test('converts objects to CSV format', () => {
      const items = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles' },
        { name: 'Bob', age: 40, city: 'Chicago' },
      ]
      const result = objects_to_csv_by_headers(headers, items)
      expect(result).toMatchInlineSnapshot(`
        "name,age,city
        Name,Age,City
        John,30,New York
        Jane,25,Los Angeles
        Bob,40,Chicago"
      `)
    })

    test('handles null, undefined, out of order, and missing values', () => {
      const items = [
        { name: 'John', age: null, city: 'New York' },
        { name: 'Jane', city: 'Los Angeles', age: undefined },
        { name: 'Bob', city: 'Chicago' },
      ]
      const result = objects_to_csv_by_headers(headers, items)
      expect(result).toMatchInlineSnapshot(`
        "name,age,city
        Name,Age,City
        John,,New York
        Jane,,Los Angeles
        Bob,,Chicago"
      `)
    })

    test('handles values with commas and quotes', () => {
      const items = [
        { name: 'John', age: 30, city: 'New York' },
        { name: 'Jane', age: 25, city: 'Los Angeles, CA' },
        { name: 'Bob', age: 40, city: 'Chicago "Windy City"' },
      ]
      const result = objects_to_csv_by_headers(headers, items)
      const expectedCsv = `name,age,city\nName,Age,City\nJohn,30,New York\nJane,25,"Los Angeles, CA"\nBob,40,"Chicago ""Windy City"""`
      expect(result).toEqual(expectedCsv)
    })

    test('handles boolean', () => {
      const headers = {
        city: 'City',
        windy: 'Windy',
      }
      const items = [{ city: 'Chicago', windy: true }]
      const result = objects_to_csv_by_headers(headers, items)
      const expectedCsv = `city,windy\nCity,Windy\nChicago,true`
      expect(result).toEqual(expectedCsv)
    })

    test('also handles abnormal header values', () => {
      const headers = {
        number: 1,
        boolean: true,
        hasComma: 'City, State',
        hasQuote: 'The "Expression"',
      }
      const items = []
      const result = objects_to_csv_by_headers(headers, items)
      const expectedCsv = `number,boolean,hasComma,hasQuote\n1,true,"City, State","The ""Expression"""`
      expect(result).toEqual(expectedCsv)
    })
  })
}

/**
 * Trigger a CSV download in the browser.
 *
 * @param rows array of plain objects — keys of the first row become headers
 * @param filename target filename (date suffix appended automatically)
 */
export function download_as_csv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0)
    return

  const headers = Object.keys(rows[0])
  const lines: string[] = []
  lines.push(headers.map(escape_csv_cell).join(','))
  for (const row of rows) {
    lines.push(headers.map(header => escape_csv_cell(row[header])).join(','))
  }
  const csv = lines.join('\r\n')

  const now = new Date()
  const date_suffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const final_name = filename.endsWith('.csv') ? filename : `${filename}_${date_suffix}.csv`

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = final_name
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function escape_csv_cell(value: unknown): string {
  if (value === null || value === undefined)
    return ''
  const stringified = String(value)
  // RFC 4180 — escape when the cell contains comma, double quote, or line break
  if (/[",\n\r]/.test(stringified))
    return `"${stringified.replace(/"/g, '""')}"`
  return stringified
}

if (import.meta.vitest) {
  describe(escape_csv_cell, () => {
    it('returns empty string for null/undefined', () => {
      expect(escape_csv_cell(null)).toBe('')
      expect(escape_csv_cell(undefined)).toBe('')
    })
    it('passes through simple values', () => {
      expect(escape_csv_cell('hello')).toBe('hello')
      expect(escape_csv_cell(42)).toBe('42')
    })
    it('quotes values containing commas', () => {
      expect(escape_csv_cell('a,b')).toBe('"a,b"')
    })
    it('quotes and double-escapes double quotes', () => {
      expect(escape_csv_cell('he said "hi"')).toBe('"he said ""hi"""')
    })
    it('quotes values with line breaks', () => {
      expect(escape_csv_cell('line1\nline2')).toBe('"line1\nline2"')
    })
  })
}

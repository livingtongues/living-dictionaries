/**
 * Human-friendly byte counts. "1.5 KB", "3.2 MB", etc. Switches units at
 * 1024 thresholds, no padding so small values stay compact ("42 B"). Used
 * for attachment size displays.
 */
export function format_bytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0)
    return ''
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

if (import.meta.vitest) {
  describe(format_bytes, () => {
    test('bytes under 1KB shown as B', () => {
      expect(format_bytes(0)).toBe('0 B')
      expect(format_bytes(42)).toBe('42 B')
      expect(format_bytes(1023)).toBe('1023 B')
    })

    test('KB threshold and rounding', () => {
      expect(format_bytes(1024)).toBe('1.0 KB')
      expect(format_bytes(1536)).toBe('1.5 KB')
      expect(format_bytes(1024 * 1023)).toBe('1023.0 KB')
    })

    test('MB threshold and rounding', () => {
      expect(format_bytes(1024 * 1024)).toBe('1.0 MB')
      expect(format_bytes(1024 * 1024 * 3.2)).toBe('3.2 MB')
    })

    test('GB threshold and rounding', () => {
      expect(format_bytes(1024 * 1024 * 1024)).toBe('1.0 GB')
      expect(format_bytes(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB')
    })

    test('null / undefined / NaN / negative → empty string', () => {
      expect(format_bytes(null)).toBe('')
      expect(format_bytes(undefined)).toBe('')
      expect(format_bytes(Number.NaN)).toBe('')
      expect(format_bytes(-1)).toBe('')
    })
  })
}

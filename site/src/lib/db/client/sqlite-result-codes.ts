/**
 * Decode a wa-sqlite numeric primary result code into its human name so logs
 * carry `MISUSE` / `CANTOPEN` / `NOTADB` instead of a bare `{"code":21}` that
 * nobody can triage without a lookup table. Only the primary (low-8-bit) codes
 * that actually surface from the browser dict.db are mapped; anything unmapped
 * falls back to `SQLITE_<n>`.
 *
 * Added after the 2026-07-04 empty-dictionary P1, where the boot-cascade rows
 * logged only `code:21` (SQLITE_MISUSE — the connection was closed mid-query by
 * a concurrent snapshot_expired reset).
 */
const PRIMARY_RESULT_CODES: Record<number, string> = {
  1: 'ERROR',
  2: 'INTERNAL',
  3: 'PERM',
  4: 'ABORT',
  5: 'BUSY',
  6: 'LOCKED',
  7: 'NOMEM',
  8: 'READONLY',
  9: 'INTERRUPT',
  10: 'IOERR',
  11: 'CORRUPT',
  12: 'NOTFOUND',
  13: 'FULL',
  14: 'CANTOPEN',
  15: 'PROTOCOL',
  17: 'SCHEMA',
  18: 'TOOBIG',
  19: 'CONSTRAINT',
  20: 'MISMATCH',
  21: 'MISUSE',
  22: 'NOLFS',
  23: 'AUTH',
  26: 'NOTADB',
}

/**
 * SQLite result codes that mean "the connection/handle was torn down under us" —
 * transient during a snapshot_expired reset or a storage_lost reopen, so the
 * caller should retry rather than surface an empty view.
 * MISUSE(21) / LOCKED(6) / BUSY(5).
 */
const TRANSIENT_CODES = new Set([21, 6, 5])

export function sqlite_code_of(error: unknown): number | null {
  const code = (error as { code?: unknown } | null | undefined)?.code
  return typeof code === 'number' ? code & 0xFF : null
}

export function decode_sqlite_code(code: number | null | undefined): string | null {
  if (typeof code !== 'number')
    return null
  const primary = code & 0xFF
  return PRIMARY_RESULT_CODES[primary] ?? `SQLITE_${primary}`
}

/**
 * True when the error is a torn-down-connection kind (numeric MISUSE/LOCKED/BUSY,
 * or a message the closing/reopening path throws) — retry-once territory.
 */
export function is_transient_connection_error(error: unknown): boolean {
  const code = sqlite_code_of(error)
  if (code !== null && TRANSIENT_CODES.has(code))
    return true
  const message = (error as { message?: unknown } | null | undefined)?.message
  return typeof message === 'string'
    && /misuse|connection is closing|access ?handle[^.]*closed|database is closed|out of sequence/i.test(message)
}

if (import.meta.vitest) {
  describe(decode_sqlite_code, () => {
    test('decodes known primary codes', () => {
      expect(decode_sqlite_code(21)).toBe('MISUSE')
      expect(decode_sqlite_code(14)).toBe('CANTOPEN')
      expect(decode_sqlite_code(26)).toBe('NOTADB')
    })
    test('masks extended codes down to the primary', () => {
      // 266 = SQLITE_IOERR_READ (10 | (1<<8)) → primary 10 = IOERR
      expect(decode_sqlite_code(266)).toBe('IOERR')
    })
    test('falls back for unmapped codes', () => {
      expect(decode_sqlite_code(99)).toBe('SQLITE_99')
    })
    test('null for non-numeric', () => {
      expect(decode_sqlite_code(null)).toBeNull()
      expect(decode_sqlite_code(undefined)).toBeNull()
    })
  })

  describe(is_transient_connection_error, () => {
    test('true for MISUSE code', () => {
      expect(is_transient_connection_error({ code: 21 })).toBe(true)
    })
    test('true for closing-connection message', () => {
      expect(is_transient_connection_error(new Error('database connection is closing'))).toBe(true)
    })
    test('false for a normal error', () => {
      expect(is_transient_connection_error(new Error('boom'))).toBe(false)
      expect(is_transient_connection_error({ code: 1 })).toBe(false)
    })
  })
}

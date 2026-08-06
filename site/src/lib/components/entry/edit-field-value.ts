import type { EntryFieldValue } from '$lib/types'

/**
 * The value a field-edit save should send.
 *
 * `bound_value` comes from a SQLite column and can be **null** — a default
 * parameter (`value = ''`) only fills `undefined`, so a null sailed through
 * three of them and reached `.trim()`, throwing BEFORE the update ran and
 * before the dialog closed. A Kayan Baram contributor clicked Save six times in
 * seven minutes across three entries with nothing to show for it (2026-08-04 log
 * review §1.2). Nothing here may assume a string.
 *
 * `input_value` wins because the IPA keyboard writes the input element's value
 * from outside the component, so the bound prop can lag behind what's on screen.
 */
export function resolve_field_save_value({ input_value, bound_value }: {
  input_value?: string | null
  bound_value?: string | null
}): string {
  return (input_value || bound_value || '').trim()
}

/**
 * Run a field-edit save. Closes the dialog only when the update actually
 * landed; a rejection goes to `on_failure` (toast + telemetry at the call site)
 * instead of escaping as an unhandled rejection — the refused-write contract:
 * a write the server refused becomes a countable event AND a visible message.
 */
export async function save_field_value({ field, input_value, bound_value, on_update, on_close, on_failure }: {
  field: EntryFieldValue
  input_value?: string | null
  bound_value?: string | null
  on_update: (new_value: string) => void | Promise<void>
  on_close: () => void
  on_failure: (info: { field: EntryFieldValue, error: unknown }) => void
}): Promise<{ saved: boolean, value: string }> {
  const value = resolve_field_save_value({ input_value, bound_value })
  try {
    await on_update(value)
  } catch (error) {
    on_failure({ field, error })
    return { saved: false, value }
  }
  on_close()
  return { saved: true, value }
}

if (import.meta.vitest) {
  describe(resolve_field_save_value, () => {
    test('a NULL column value becomes an empty string instead of throwing', () => {
      expect(resolve_field_save_value({ input_value: undefined, bound_value: null })).toBe('')
    })

    test('both sides missing', () => {
      expect(resolve_field_save_value({})).toBe('')
    })

    test('the live input wins over the bound value (IPA keyboard writes it from outside)', () => {
      expect(resolve_field_save_value({ input_value: 'kʰa', bound_value: 'kha' })).toBe('kʰa')
    })

    test('falls back to the bound value when there is no input element (phonetic modal)', () => {
      expect(resolve_field_save_value({ input_value: undefined, bound_value: ' kha ' })).toBe('kha')
    })
  })

  describe(save_field_value, () => {
    test('a NULL value saves an empty string and closes the dialog', async () => {
      const on_update = vi.fn()
      const on_close = vi.fn()
      const on_failure = vi.fn()
      const result = await save_field_value({ field: 'phonetic', bound_value: null, on_update, on_close, on_failure })
      expect(result).toEqual({ saved: true, value: '' })
      expect(on_update).toHaveBeenCalledExactlyOnceWith('')
      expect(on_close).toHaveBeenCalledOnce()
      expect(on_failure).not.toHaveBeenCalled()
    })

    test('a rejected update reports the field, keeps the dialog open, and does not throw', async () => {
      const error = new Error('Editing database is not ready yet')
      const on_close = vi.fn()
      const on_failure = vi.fn()
      const result = await save_field_value({
        field: 'lexeme',
        input_value: 'kya',
        on_update: () => Promise.reject(error),
        on_close,
        on_failure,
      })
      expect(result).toEqual({ saved: false, value: 'kya' })
      expect(on_failure).toHaveBeenCalledExactlyOnceWith({ field: 'lexeme', error })
      expect(on_close).not.toHaveBeenCalled()
    })
  })
}

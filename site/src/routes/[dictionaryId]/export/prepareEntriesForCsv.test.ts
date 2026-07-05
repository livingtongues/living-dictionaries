import type { EntryData, Tables } from '$lib/types'
import type { TranslateFunction } from '$lib/i18n/types'
import { formatCsvEntries, translate_entries } from './prepare-entries-for-csv'

describe(formatCsvEntries, () => {
  const dictionary = {
    id: 'test-dict',
    orthographies: [
      { code: 'default', name: 'Latin', primary: true },
      { code: 'x-alt', name: 'Alt Script' },
    ],
  } as Tables<'dictionaries'>
  const t = ((key: string) => key) as unknown as TranslateFunction
  const url_from_storage_path = (path: string) => path

  test('lexeme column falls back to the first populated alternate orthography; alternate column stays faithful', () => {
    const entries = [
      { id: 'e1', main: { lexeme: { 'default': 'foo', 'x-alt': 'FOO' } }, senses: [] },
      { id: 'e2', main: { lexeme: { 'x-alt': 'BAR' } }, senses: [] },
    ] as unknown as EntryData[]

    const [with_default, promoted] = formatCsvEntries(
      translate_entries({ entries, t, url_from_storage_path }),
      url_from_storage_path,
      dictionary,
    ) as Record<string, string>[]
    expect(with_default.lexeme).toBe('foo')
    expect(with_default.localOrthography).toBe('FOO')
    expect(promoted.lexeme).toBe('BAR')
    expect(promoted.localOrthography).toBe('BAR')
  })
})

import type { DictionaryView } from '@living-dictionaries/types'

export const basic_mock_dictionary: Partial<DictionaryView> = {
  id: 'gta',
  name: 'Gtaʼ',
  gloss_languages: ['en', 'es'],
  orthographies: [
    {
      bcp: '',
      name: { default: 'The first' },
    },
    {
      bcp: '',
      name: { default: 'The second' },
    },
    {
      bcp: '',
      name: { default: 'The third' },
    },
  ],
}

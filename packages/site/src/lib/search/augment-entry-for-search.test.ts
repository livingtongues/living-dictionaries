import type { EntryData } from '@living-dictionaries/types'
import { augment_entry_for_search, simplify_lexeme_for_search } from './augment-entry-for-search'
// import { complex } from '$lib/mocks/entries'

describe(augment_entry_for_search, () => {
  test('does not choke on undefineds', () => {
    const result_from_nothing = augment_entry_for_search({ senses: [], main: { lexeme: { default: '' } } } as unknown as EntryData)
    expect(result_from_nothing).toMatchInlineSnapshot(`
      {
        "_dialects": [],
        "_glosses": [],
        "_lexeme": [],
        "_other": [],
        "_parts_of_speech": [],
        "_semantic_domains": [],
        "_speakers": [],
        "_tags": [],
        "has_audio": false,
        "has_image": false,
        "has_noun_class": false,
        "has_part_of_speech": false,
        "has_plural_form": false,
        "has_semantic_domain": false,
        "has_sentence": false,
        "has_speaker": false,
        "has_video": false,
        "main": {
          "lexeme": {
            "default": "",
          },
        },
        "senses": [],
      }
    `)
  })

  test('changes filter periods to two underscores and space to one', () => {
    const result = augment_entry_for_search({ senses: [{
      semantic_domains: ['1.5', '2'],
      write_in_semantic_domains: ['kitchen stuff'],
      parts_of_speech: ['v.i.', 'n'],
    }], main: { lexeme: { default: '' } } } as unknown as EntryData)
    expect(result._parts_of_speech).toEqual(['v__i__', 'n'])
    expect(result._semantic_domains).toEqual(['1__5', '2', 'kitchen_stuff'])
  })

  test('brings in tags, dialects, and speakers correctly', () => {
    const result = augment_entry_for_search({
      main: { lexeme: { default: '' } },
      tags: [{ name: 'tag1' }, { name: 'tag2' }],
      dialects: [{ name: { default: 'dialect1' } }, { name: { default: 'dialect2' } }],
      audios: [{ speakers: [{ name: 'speaker1' }] }, { speakers: [{ name: 'speaker2' }, { name: 'speaker3' }] }, {}],
    } as unknown as EntryData)
    expect(result._tags).toEqual(['tag1', 'tag2'])
    expect(result._dialects).toEqual(['dialect1', 'dialect2'])
    expect(result._speakers).toEqual(['speaker1', 'speaker2', 'speaker3'])
  })
})

describe(simplify_lexeme_for_search, () => {
  test('removes diacritics', () => {
    expect(simplify_lexeme_for_search('põsret')).toEqual('posret')
    expect(simplify_lexeme_for_search('akʰe:')).toEqual('akhe:')
  })
})

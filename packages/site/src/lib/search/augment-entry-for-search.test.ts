import type { EntryView } from '@living-dictionaries/types'
import { augment_entry_for_search, simplify_lexeme_for_search } from './augment-entry-for-search'
// import { complex } from '$lib/mocks/entries'

describe(augment_entry_for_search, () => {
  test('does not choke on undefineds', () => {
    const result_from_nothing = augment_entry_for_search({ senses: [], main: { lexeme: { default: '' } } } as unknown as EntryView)
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
    }], main: { lexeme: { default: '' } } } as unknown as EntryView)
    expect(result._parts_of_speech).toEqual(['v__i__', 'n'])
    expect(result._semantic_domains).toEqual(['1__5', '2', 'kitchen_stuff'])
  })
})

describe(simplify_lexeme_for_search, () => {
  test('removes diacritics', () => {
    expect(simplify_lexeme_for_search('põsret')).toEqual('posret')
    expect(simplify_lexeme_for_search('akʰe:')).toEqual('akhe:')
  })
})

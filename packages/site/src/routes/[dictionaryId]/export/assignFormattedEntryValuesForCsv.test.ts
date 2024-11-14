import type { EntryView, Tables } from '@living-dictionaries/types'
import {
  display_speaker_gender,
  find_part_of_speech_abbreviation,
  // format_example_sentences,
  // format_gloss_languages,
  // format_semantic_domains,
  get_first_speaker_from_first_sound_file,
} from './assignFormattedEntryValuesForCsv'

describe(find_part_of_speech_abbreviation, () => {
  const global_parts_of_speech = [
    {
      enAbbrev: 'n',
      enName: 'noun',
    },
  ]

  test('finds readable part of speech name', () => {
    const part_of_speech = 'noun'
    expect(find_part_of_speech_abbreviation(global_parts_of_speech, part_of_speech)).toEqual('n')
  })

  test('return undefined if abbreviation does not exist', () => {
    const part_of_speech = null
    expect(find_part_of_speech_abbreviation(global_parts_of_speech, part_of_speech)).toEqual(
      undefined,
    )
  })
})

describe(get_first_speaker_from_first_sound_file, () => {
  test('gets speaker', () => {
    const speakers: Tables<'speakers_view'>[] = [
      {
        name: 'Arthur Morgan',
        id: 'rdr2',
        birthplace: 'New Hanover',
        decade: 3,
        gender: 'm',
      },
    ] as Tables<'speakers_view'>[]
    const entry: EntryView = {
      audios: [{
        storage_path: 'https://database.com/example.mp3',
        // storage_url: 'https://database.com/example.mp3',
        speaker_ids: ['rdr2'],
      }],
    } as EntryView
    expect(get_first_speaker_from_first_sound_file(entry, speakers)).toEqual(speakers[0])
  })

  test('returns undefined if no speaker', () => {
    const speakers: Tables<'speakers_view'>[] = []
    const entry: EntryView = {
      audios: [{
        storage_path: 'https://database.com/example.mp3',
        // storage_url: 'https://database.com/example.mp3',
        speaker_ids: ['rdr2'],
      }],
    } as EntryView
    expect(get_first_speaker_from_first_sound_file(entry, speakers)).toEqual(undefined)
  })
})

describe(display_speaker_gender, () => {
  test('displays readable speaker gender', () => {
    expect(display_speaker_gender('m')).toEqual('male')
  })

  test('displays empty string if speaker gender it is an empty string or undefined', () => {
    expect(display_speaker_gender('')).toEqual(undefined)
    expect(display_speaker_gender(undefined)).toEqual(undefined)
  })
})

// describe('format arrays into objects', () => {
//   test(format_semantic_domains, () => {
//     const entry: ExpandedEntry = {
//       senses: [{ translated_ld_semantic_domains: ['Colors', 'Birds'] }],
//     }
//     const expected = {
//       semantic_domain_1: 'Colors',
//       semantic_domain_2: 'Birds',
//     }
//     expect(format_semantic_domains(entry)).toEqual(expected)
//   })

//   test(format_gloss_languages, () => {
//     const entry: ExpandedEntry = {
//       senses: [{ glosses: { es: 'oso' } }],
//     }
//     const expected = {
//       es_gloss_language: 'oso',
//     }
//     expect(format_gloss_languages(entry)).toEqual(expected)
//   })

//   test(format_example_sentences, () => {
//     const entry: ExpandedEntry = {
//       senses: [{ example_sentences: [{ es: 'el oso es enorme', vn: 'native example' }] }],
//     }
//     const expected = {
//       es_example_sentence: 'el oso es enorme',
//       vernacular_example_sentence: 'native example',
//     }
//     expect(format_example_sentences(entry)).toEqual(expected)
//   })
// })

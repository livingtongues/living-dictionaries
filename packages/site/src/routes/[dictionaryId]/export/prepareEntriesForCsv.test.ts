// import type {
//   ExpandedEntry,
//   IDictionary,
//   IPartOfSpeech,
//   ISpeaker,
// } from '@living-dictionaries/types'
// import { StandardEntryCSVFields, formatCsvEntries, getCsvHeaders } from './prepareEntriesForCsv'
// import { objectsToCsvByHeaders } from '$lib/export/csv'

// describe('prepareEntriesForCsv', () => {
//   const speakers: ISpeaker[] = [
//     {
//       displayName: 'John Smith',
//       id: '123',
//       birthplace: 'Whoville',
//       decade: 4,
//       gender: 'm',
//     },
//   ]
//   const partsOfSpeech: IPartOfSpeech[] = [{ enAbbrev: 'n', enName: 'noun' }] // TODO: after updated expanded entries to include abbreviations, this will no longer be needed in prepareEntriesForCsv

//   test('everything', () => {
//     const dictionary: IDictionary = {
//       name: 'TestLang',
//       id: 'testDictionary',
//       glossLanguages: ['ar', 'en', 'es'],
//       alternateOrthographies: ['native_script_1', 'native_script_2'],
//     }
//     const entries: ExpandedEntry[] = [
//       {
//         id: '12345qwerty',
//         lexeme: 'xiangjiao',
//         local_orthography_2: 'کیلا',
//         senses: [
//           {
//             glosses: { ar: 'foo', en: 'banana' },
//             translated_parts_of_speech: ['noun', 'adjective'],
//             translated_ld_semantic_domains: ['Body parts', 'Body functions'],
//             example_sentences: [{ en: 'This is a banana', vn: '我很喜歡吃香蕉' }],
//             photo_files: [
//               {
//                 fb_storage_path: 'https://database.com/image.png',
//                 storage_url: 'https://database.com/image.png',
//                 uid_added_by: 'Diego',
//               },
//             ],
//           },
//         ],
//         phonetic: 'xiangjiao',
//         dialects: ['dialect x'],
//         notes: 'This is an example of a note, here we can write whatever we want.',
//         sources: ['A book', 'www.mybook.com'],
//         sound_files: [{
//           fb_storage_path: 'https://database.com/sound.mp3',
//           storage_url: 'https://database.com/sound.mp3',
//           speaker_ids: ['123'],
//         }],
//       },
//       {
//         id: '34qw',
//         lexeme: 'tree',
//         local_orthography_1: '𑃐𑃥𑃝𑃢 𑃒𑃦𑃗𑃠𑃤',
//         local_orthography_2: 'চুড়া বংজি',
//         senses: [{ glosses: { es: 'árbol' } }],
//         variant: 'bananer',
//       },
//     ]

//     const headers = getCsvHeaders(entries, dictionary)
//     const formattedEntries = formatCsvEntries(entries, speakers, partsOfSpeech)

//     const expectedHeaders_PlusDynamic_ArEnEs_TwoLocalOrthographies = {
//       ...StandardEntryCSVFields,
//       local_orthography_1: 'native_script_1',
//       local_orthography_2: 'native_script_2',
//       ar_gloss_language: 'العَرَبِيَّة‎ Gloss',
//       en_gloss_language: 'English Gloss',
//       es_gloss_language: 'español Gloss',
//       ar_example_sentence: 'Example sentence in العَرَبِيَّة‎',
//       en_example_sentence: 'Example sentence in English',
//       es_example_sentence: 'Example sentence in español',
//       vernacular_example_sentence: 'Example sentence in TestLang',
//       semantic_domain_1: 'Semantic domain 1',
//       semantic_domain_2: 'Semantic domain 2',
//     }

//     expect(headers).toMatchObject(expectedHeaders_PlusDynamic_ArEnEs_TwoLocalOrthographies)
//     expect(formattedEntries).toMatchFileSnapshot('./test-output/prepareEntriesForCsv_noHeaders.txt')
//     expect(objectsToCsvByHeaders(headers, formattedEntries)).toMatchFileSnapshot('./test-output/prepareEntriesForCsv.csv')
//   })

//   // TODO: allow multiple parts of speech

//   describe('variant column', () => {
//     test('added when entries have variants', () => {
//       const dictionary = {} as IDictionary
//       const entries: ExpandedEntry[] = [
//         {
//           lexeme: 'foo',
//           variant: 'fooey',
//         },
//         {
//           lexeme: 'baz',
//         },
//       ]

//       const headers = getCsvHeaders(entries, dictionary)
//       const [firstEntry, secondEntry] = formatCsvEntries(entries, speakers, partsOfSpeech)

//       expect(headers.variant).toEqual('Variant')
//       expect(firstEntry.variant).toEqual('fooey')
//       expect(secondEntry.variant).toBeFalsy()
//     })

//     test('not added when entries do not have variants', () => {
//       const dictionary = {} as IDictionary
//       const entries: ExpandedEntry[] = [{ lexeme: 'foo' }]
//       const { variant } = getCsvHeaders(entries, dictionary)
//       expect(variant).toBeFalsy()
//     })
//   })
// })

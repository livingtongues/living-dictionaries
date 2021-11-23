import type { IDictionary, IEntry, ISpeaker } from '$lib/interfaces';
import { formatEntriesForCSV } from './_formatEntries';

test('formatEntriesForCSV prepares ________', () => {
  const entriesArray: IEntry[] = [
    { id: '12ar', lx: 'banana', gl: { es: 'platano' } },
    { id: '34qw', lx: 'tree', gl: { es: 'arbol' } },
  ];
  const dictionary: IDictionary = { name: 'test', glossLanguages: ['en', 'es'], entryCount: 0 };
  const speakers: ISpeaker[] = [{ displayName: 'John Smith', id: '123' }];
  expect(formatEntriesForCSV(entriesArray, dictionary, speakers)).toMatchInlineSnapshot(`
    Array [
      Object {
        "auFriendlyName": "Audio filename",
        "aubp": "Speaker birthplace",
        "aude": "Speaker decade",
        "auge": "Speaker gender",
        "ausn": "Speaker name",
        "di": "Dialect for this entry",
        "glen": "English Gloss",
        "gles": "Spanish Gloss",
        "id": "Entry id",
        "imFriendlyName": "Image filename",
        "in": "Interlinearization",
        "lx": "Lexeme/Word/Phrase",
        "mr": "Morphology",
        "nt": "Notes",
        "ph": "Phonetic (IPA)",
        "ps": "Parts of speech",
        "psab": "Parts of speech abbreviation",
        "sr": "Source(s)",
        "xsen": "Example sentence in English",
        "xses": "Example sentence in Spanish",
        "xsvn": "Example sentence in test",
      },
      Object {
        "auFriendlyName": "",
        "aubp": "",
        "aude": "",
        "auge": "",
        "ausn": "",
        "di": "",
        "glen": "",
        "gles": "platano",
        "id": "12ar",
        "imFriendlyName": "",
        "in": "",
        "lx": "banana",
        "mr": "",
        "nt": "",
        "ph": "",
        "ps": "",
        "psab": "",
        "sr": "",
        "xsen": "",
        "xses": "",
        "xsvn": "",
      },
      Object {
        "auFriendlyName": "",
        "aubp": "",
        "aude": "",
        "auge": "",
        "ausn": "",
        "di": "",
        "glen": "",
        "gles": "arbol",
        "id": "34qw",
        "imFriendlyName": "",
        "in": "",
        "lx": "tree",
        "mr": "",
        "nt": "",
        "ph": "",
        "ps": "",
        "psab": "",
        "sr": "",
        "xsen": "",
        "xses": "",
        "xsvn": "",
      },
    ]
  `);
});

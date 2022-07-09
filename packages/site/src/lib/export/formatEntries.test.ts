import type { IDictionary, IEntry, ISemanticDomain, ISpeaker } from '@living-dictionaries/types';
import { formatEntriesForCSV } from './formatEntries';

test('formatEntriesForCSV basic example to smoke test', () => {
  const entriesArray: IEntry[] = [
    {
      id: '12ar',
      lx: 'banana',
      lo: 'کیلا',
      ph: 'banana',
      gl: { es: 'platano' },
      ps: '1',
      sdn: ['2.1', '2.2', '2.3'],
      di: 'dialect x',
      nt: 'This is an example of a note, here we can write whatever we want.',
      sr: ['A book', 'www.mybook.com'],
      xs: { en: 'This is a banana' },
      sf: { path: 'https://example.com', sp: 'aa34' },
      pf: { gcs: 'https://example.com', path: 'https://example.com' },
    },
    { id: '34qw', lx: 'tree', gl: { es: 'arbol' } },
  ];
  const dictionary: IDictionary = { name: 'test', glossLanguages: ['ar', 'en'], entryCount: 0 };
  const speakers: ISpeaker[] = [{ displayName: 'John Smith', id: '123' }];
  const semanticDomains: ISemanticDomain[] = [{ key: '2.1', name: 'Plant Test Domain' }];
  expect(formatEntriesForCSV(entriesArray, dictionary, speakers, semanticDomains, [])).toMatchSnapshot();
});

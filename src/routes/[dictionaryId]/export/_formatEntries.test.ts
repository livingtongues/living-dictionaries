import type { IDictionary, IEntry, ISpeaker } from '$lib/interfaces';
import { formatEntriesForCSV } from './_formatEntries';

test('Example to demonstrate separate file snapshots.', () => {
  const entriesArray: IEntry[] = [
    {
      id: '12ar',
      lx: 'banana',
      lo: 'کیلا',
      ph: 'banana',
      gl: { es: 'platano' },
      ps: '1',
      sdn: ['2.1.2.3'],
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
  expect(formatEntriesForCSV(entriesArray, dictionary, speakers)).toMatchSnapshot();
});

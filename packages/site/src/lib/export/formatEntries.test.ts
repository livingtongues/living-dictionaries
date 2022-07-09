import type { IDictionary, IEntry, IPartOfSpeech, ISemanticDomain, ISpeaker } from '@living-dictionaries/types';
import { formatEntriesForCSV } from './formatEntries';

test('formatEntriesForCSV basic example to smoke test', () => {
  const entriesArray: IEntry[] = [
    {
      id: '12345qwerty',
      lx: 'xiangjiao',
      lo: 'کیلا',
      in: 'n',
      mr: 'bar',
      nc: '5',
      ph: 'xiangjiao',
      gl: { es: 'platano', ar: 'foo', en: 'banana' },
      ps: 'n',
      pl: 'shuang xiangjiao',
      sdn: ['2.1', '2.2', '2.3'],
      di: 'dialect x',
      nt: 'This is an example of a note, here we can write whatever we want.',
      sr: ['A book', 'www.mybook.com'],
      xs: { en: 'This is a banana', vn: '我很喜歡吃香蕉' },
      sf: { path: 'https://database.com/sound.mp3', sp: '123' },
      pf: { gcs: 'not_needed_here', path: 'https://database.com/image.mp3' },
      xv: '',
    },
    { id: '34qw', lx: 'tree', gl: { es: 'arbol' } },
  ];
  const dictionary: IDictionary = { name: 'test', glossLanguages: ['ar', 'en'], entryCount: 0 };
  const speakers: ISpeaker[] = [{ displayName: 'John Smith', id: '123', birthplace: 'Whoville', decade: 4, gender: 'm' }];
  const semanticDomains: ISemanticDomain[] = [{ key: '2.1', name: 'Plant Test Domain' }];
  const partsOfSpeech: IPartOfSpeech[] = [{ enAbbrev: 'n',
    enName: 'noun', }];
  expect(formatEntriesForCSV(entriesArray, dictionary, speakers, semanticDomains, partsOfSpeech)).toMatchSnapshot();
});

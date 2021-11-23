import { formatEntriesForCSV } from './_formatEntries';

test('formatEntriesForCSV prepares ________', () => {
  const entriesArray = [];
  const dictionary = { name: 'test', glossLanguages: ['en', 'es'], entryCount: 0 };
  expect(formatEntriesForCSV(entriesArray, dictionary)).toBe(true);
});

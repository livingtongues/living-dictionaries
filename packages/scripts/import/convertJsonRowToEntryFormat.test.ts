import { convertJsonRowToEntryFormat } from './convertJsonRowToEntryFormat.js';
import { readFileSync } from 'fs';
import { parseCSVFrom } from './parse-csv.js';

test('convertJsonRowToEntryFormat properly converts entries', async () => {
  const dateStamp = Date.now();
  const dictionaryId = 'example';
  const file = readFileSync(`./import/data/${dictionaryId}/${dictionaryId}.csv`, 'utf8');
  const rows = parseCSVFrom(file);
  const entries = rows.map((row: any) => convertJsonRowToEntryFormat(row, dateStamp));
  expect(entries).toMatchInlineSnapshot();
});



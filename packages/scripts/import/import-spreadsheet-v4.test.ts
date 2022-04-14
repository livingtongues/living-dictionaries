import {
  convertJsonRowToEntryFormat,
  parseSourceFromNotes,
} from './import-spreadsheet-v4';
import { readFileSync } from 'fs';
import { parseCSVFrom } from './parse-csv.js';

test.skip('Import and convert 200 entries', async () => {
  const dateStamp = Date.now();
  const dictionaryId = 'CHANGE';
  const file = readFileSync(`./import/data/${dictionaryId}/${dictionaryId}.csv`, 'utf8');
  const rows = parseCSVFrom(file);
  const entries = rows.map((row: any) => convertJsonRowToEntryFormat(row, dateStamp));
  expect(entries.length).toBe(200);
  // expect(entries[0]).toStrictEqual({"ca": {}, "gl": {"en": "one", "es": "uno"}, "ii": "v4-1617811194070", "lx": "iin", "ps": "no", "sdn": ["7.1"], "ua": {}});
  // expect(entries[0]).toStrictEqual({"di": "Tegüima", "gl": {"en": "Yours", "es": "Suyo"}, "lx": "Are", "sr": ["Page 48 Opata-Spanish Dictionary"], "ps": "pro"});
});

test('parseSourceFromNotes handles notes field w/ both notes and source', () => {
  expect(
    parseSourceFromNotes(
      `Platicaba Dona Benigna Romero, Opata de Bacadehuachi, que antiguamente “maca” era el nombre de ciertas víboras, que cargaban los pedigüeños, tal vez para llamar la atención, para distinguirse o quizá para tener suerte. Source: Vestigios de la Cultura Opata Rodolfo Rascon`
    ).notes
  ).toBe(
    'Platicaba Dona Benigna Romero, Opata de Bacadehuachi, que antiguamente “maca” era el nombre de ciertas víboras, que cargaban los pedigüeños, tal vez para llamar la atención, para distinguirse o quizá para tener suerte.'
  );

  expect(
    parseSourceFromNotes(
      `Platicaba Dona Benigna Romero, Opata de Bacadehuachi, que antiguamente “maca” era el nombre de ciertas víboras, que cargaban los pedigüeños, tal vez para llamar la atención, para distinguirse o quizá para tener suerte. Source: Vestigios de la Cultura Opata Rodolfo Rascon`
    ).source
  ).toBe('Vestigios de la Cultura Opata Rodolfo Rascon');
});

test('parseSourceFromNotes handles whitespace trimming interiorly also', () => {
  expect(
    parseSourceFromNotes(`Se usa a manera de aclaración, o segunda respuesta, cuando seconsidera que la primera no ha sido entendida.

    Source:
    Page 228
    Opata-Spanish Dictionary`).source
  ).toBe('Page 228 Opata-Spanish Dictionary');
});

test('parseSourceFromNotes handles source only', () => {
  expect(
    parseSourceFromNotes(`Source:
    Page 228
    Opata-Spanish Dictionary`).source
  ).toBe('Page 228 Opata-Spanish Dictionary');
});

test('parseSourceFromNotes handles notes w/o a source part', () => {
  expect(
    parseSourceFromNotes(
      `Se usa a manera de aclaración, o segunda respuesta, cuando seconsidera que la primera no ha sido entendida.`
    ).notes
  ).toBe(
    'Se usa a manera de aclaración, o segunda respuesta, cuando seconsidera que la primera no ha sido entendida.'
  );
});

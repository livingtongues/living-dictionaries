import type { IEntry } from '@living-dictionaries/types';
import type { Timestamp } from 'firebase/firestore';

export function convertJsonRowToEntryFormat(
  row: Record<string, string>,
  dateStamp: number,
  timestamp: FirebaseFirestore.FieldValue
): IEntry {
  const entry: IEntry = { lx: row.lexeme, gl: {}, xs: {} };

  Boolean(row.phonetic) && (entry.ph = row.phonetic);
  Boolean(row.morphology) && (entry.mr = row.morphology);
  Boolean(row.interlinearization) && (entry.in = row.interlinearization);
  Boolean(row.partOfSpeech) && (entry.ps = returnArrayFromCommaSeparatedItems(row.partOfSpeech));
  Boolean(row.dialect) && (entry.di = row.dialect);
  Boolean(row.variant) && (entry.va = row.variant);
  Boolean(row.nounClass) && (entry.nc = row.nounClass);
  Boolean(row.source) && (entry.sr = row.source.split('|'));
  Boolean(row.pluralForm) && (entry.pl = row.pluralForm);
  Boolean(row.scientificName) && (entry.scn = [row.scientificName]);
  Boolean(row.semanticDomain_custom) && (entry.sd = [row.semanticDomain_custom]);
  Boolean(row.ID) && (entry.ei = row.ID);

  Boolean(row.localOrthography) && (entry.lo = row.localOrthography);
  Boolean(row.localOrthography2) && (entry.lo2 = row.localOrthography2);
  Boolean(row.localOrthography3) && (entry.lo3 = row.localOrthography3);
  Boolean(row.localOrthography4) && (entry.lo4 = row.localOrthography4);
  Boolean(row.localOrthography5) && (entry.lo5 = row.localOrthography5);

  Boolean(row.notes) && (entry.nt = row.notes);

  const semantic_domains_regex = /^semanticDomain\d*$/;
  Object.keys(row).forEach((key) => {
    if (semantic_domains_regex.test(key) && row[key]) {
      entry.sdn = [];
      Object.entries(row).forEach((semantic_domain) => {
        if (semantic_domains_regex.test(semantic_domain[0])) {
          Boolean(semantic_domain[1]) && entry.sdn.push(semantic_domain[1].toString());
        }
      });
    }

    // gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
    if (key.includes('_gloss') && row[key]) {
      const language = key.split('_gloss')[0];
      entry.gl[language] = row[key];
      return;
    }

    if (key.includes('vernacular_exampleSentence') && row[key]) {
      return (entry.xs['vn'] = row[key]);
    }

    // example sentence fields are codes followed by '_exampleSentence'
    if (key.includes('_exampleSentence') && row[key]) {
      const language = key.split('_exampleSentence')[0];
      entry.xs[language] = row[key];
    }
  });
  if (Object.keys(entry.xs).length === 0) {
    delete entry.xs;
  }

  entry.ii = `v4-${dateStamp}`;
  entry.ca = timestamp as Timestamp;
  entry.ua = timestamp as Timestamp;

  return entry;
}

function returnArrayFromCommaSeparatedItems(string: string): string[] {
  return string?.split(',').map((item) => item.trim()) || [];
}

if (import.meta.vitest) {
  describe('returnArrayFromCommaSeparatedItems', () => {
    test('splits two comma separated items into an array', () => {
      expect(returnArrayFromCommaSeparatedItems('n,v')).toStrictEqual(['n', 'v']);
    });
    test('handles unusual comma spacing', () => {
      expect(returnArrayFromCommaSeparatedItems('n, v ,adj')).toStrictEqual(['n', 'v', 'adj']);
    });
    test('returns empty array from undefined', () => {
      expect(returnArrayFromCommaSeparatedItems(undefined)).toStrictEqual([]);
    });
  });
}

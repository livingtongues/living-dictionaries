import type { IEntry } from '@living-dictionaries/types';

export function convertJsonRowToEntryFormat(row: Record<string, string>, dateStamp: number, timestamp: FirebaseFirestore.FieldValue): IEntry {
  const entry: IEntry = { lx: row.lexeme, gl: {}, xs: {} };

  Boolean(row.phonetic) && (entry.ph = row.phonetic);
  Boolean(row.morphology) && (entry.mr = row.morphology);
  Boolean(row.interlinearization) && (entry.in = row.interlinearization);
  Boolean(row.partOfSpeech) && (entry.ps = row.partOfSpeech);
  Boolean(row.dialect) && (entry.di = row.dialect);
  Boolean(row.variant) && (entry.va = row.variant);
  Boolean(row.nounClass) && (entry.nc = row.nounClass);
  Boolean(row.source) && (entry.sr = row.source.split('|'));
  if (row.semanticDomain || row.semanticDomain2) {
    entry.sdn = [];
    Boolean(row.semanticDomain) && entry.sdn.push(row.semanticDomain.toString());
    Boolean(row.semanticDomain2) && entry.sdn.push(row.semanticDomain2.toString());
  }
  Boolean(row.semanticDomain_custom) && (entry.sd = [row.semanticDomain_custom]);
  Boolean(row.ID) && (entry.ei = row.ID);

  Boolean(row.localOrthography) && (entry.lo = row.localOrthography);
  Boolean(row.localOrthography2) && (entry.lo2 = row.localOrthography2);
  Boolean(row.localOrthography3) && (entry.lo3 = row.localOrthography3);
  Boolean(row.localOrthography4) && (entry.lo4 = row.localOrthography4);
  Boolean(row.localOrthography5) && (entry.lo5 = row.localOrthography5);

  Boolean(row.notes) && (entry.nt = row.notes);
  // Notes parsing for Opata
  // if (row.notes) {
  //     const parsedNotes = parseSourceFromNotes(row.notes);
  //     Boolean(parsedNotes.notes) && (entry.nt = parsedNotes.notes);
  //     Boolean(parsedNotes.source) && (entry.sr = [parsedNotes.source]);
  // }

  Object.keys(row).forEach((key) => {
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
  entry.ca = timestamp;
  entry.ua = timestamp;

  return entry;
}

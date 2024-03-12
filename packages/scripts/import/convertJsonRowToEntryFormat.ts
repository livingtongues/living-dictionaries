import type { ActualDatabaseEntry } from '@living-dictionaries/types';
import type { Timestamp } from 'firebase/firestore';

export function convertJsonRowToEntryFormat(
  row: Record<string, string>,
  dateStamp?: number,
  // eslint-disable-next-line no-undef
  timestamp?: FirebaseFirestore.FieldValue
): ActualDatabaseEntry {
  const entry: ActualDatabaseEntry = { lx: row.lexeme, gl: {}, xs: {} };

  if (row.phonetic) entry.ph = row.phonetic;
  if (row.morphology) entry.mr = row.morphology;
  if (row.interlinearization) entry.in = row.interlinearization;
  if (row.partOfSpeech) entry.ps = returnArrayFromCommaSeparatedItems(row.partOfSpeech);
  if (row.dialects) entry.di = row.dialects.split(',').map(dialect => dialect.trim());
  if (row.variant) entry.va = row.variant;
  if (row.nounClass) entry.nc = row.nounClass;
  if (row.source) entry.sr = row.source.split('|');
  if (row.pluralForm) entry.pl = row.pluralForm;
  if (row.scientificName) entry.scn = [row.scientificName];
  if (row.semanticDomain_custom) entry.sd = [row.semanticDomain_custom];
  if (row.ID) entry.ei = row.ID;

  if (row.localOrthography) entry.lo = row.localOrthography;
  if (row.localOrthography2) entry.lo2 = row.localOrthography2;
  if (row.localOrthography3) entry.lo3 = row.localOrthography3;
  if (row.localOrthography4) entry.lo4 = row.localOrthography4;
  if (row.localOrthography5) entry.lo5 = row.localOrthography5;

  if (row.notes) entry.nt = row.notes;

  for (const [key, value] of Object.entries(row)) {
    if (!value) continue;

    // gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
    if (key.includes('_gloss')) {
      const language = key.split('_gloss')[0];
      entry.gl[language] = value;
    }

    if (key.includes('vernacular_exampleSentence')) {
      entry.xs.vn = value;
      continue; // to keep next block from also adding
    }

    // example sentence fields are codes followed by '_exampleSentence'
    if (key.includes('_exampleSentence')) {
      const language = key.split('_exampleSentence')[0];
      entry.xs[language] = value;
    }

    const semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT = /^semanticDomain\d*$/; // semanticDomain, semanticDomain2, semanticDomain<#>, but not semanticDomain_custom
    if (semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT.test(key)) {
      if (!entry.sdn) entry.sdn = [];

      entry.sdn.push(value.toString());
    }
  }

  if (Object.keys(entry.xs).length === 0)
    delete entry.xs;


  if (!dateStamp) return entry;

  entry.ii = `v4-${dateStamp}`;
  entry.ca = timestamp as Timestamp;
  entry.ua = timestamp as Timestamp;

  return entry;
}

export function returnArrayFromCommaSeparatedItems(string: string): string[] {
  return string?.split(',').map((item) => item.trim()) || [];
}

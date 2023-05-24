import type { GoalDatabaseEntry } from '@living-dictionaries/types';
import type { Timestamp } from 'firebase/firestore';

export function convertJsonRowToEntryFormat(
  row: Record<string, string>,
  dateStamp?: number,
  timestamp?: FirebaseFirestore.FieldValue
): GoalDatabaseEntry {
  const entry: GoalDatabaseEntry = { lx: row.lexeme, sn: [{ gl: {}, xs: [{}] }] };

  Boolean(row.phonetic) && (entry.ph = row.phonetic);
  Boolean(row.morphology) && (entry.mr = row.morphology);
  Boolean(row.interlinearization) && (entry.in = row.interlinearization);
  Boolean(row.partOfSpeech) &&
    (entry.sn[0].ps = returnArrayFromCommaSeparatedItems(row.partOfSpeech));
  Boolean(row.dialects) && (entry.di = row.dialects.split(',').map((dialect) => dialect.trim()));
  Boolean(row.variant) && (entry.va = row.variant);
  Boolean(row.nounClass) && (entry.sn[0].nc = row.nounClass);
  Boolean(row.source) && (entry.sr = row.source.split('|'));
  Boolean(row.pluralForm) && (entry.pl = row.pluralForm);
  Boolean(row.scientificName) && (entry.scn = [row.scientificName]);
  Boolean(row.semanticDomain_custom) && (entry.sn[0].sd = [row.semanticDomain_custom]);
  Boolean(row.ID) && (entry.ei = row.ID);

  Boolean(row.localOrthography) && (entry.lo1 = row.localOrthography);
  Boolean(row.localOrthography2) && (entry.lo2 = row.localOrthography2);
  Boolean(row.localOrthography3) && (entry.lo3 = row.localOrthography3);
  Boolean(row.localOrthography4) && (entry.lo4 = row.localOrthography4);
  Boolean(row.localOrthography5) && (entry.lo5 = row.localOrthography5);

  Boolean(row.notes) && (entry.nt = row.notes);

  for (const [key, value] of Object.entries(row)) {
    if (!value) continue;

    // gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
    if (key.includes('_gloss')) {
      const language = key.split('_gloss')[0];
      entry.sn[0].gl[language] = value;
    }

    if (key.includes('vernacular_exampleSentence')) {
      entry.sn[0].xs[0]['vn'] = value;
      continue; // to keep next block from also adding
    }

    // example sentence fields are codes followed by '_exampleSentence'
    if (key.includes('_exampleSentence')) {
      const language = key.split('_exampleSentence')[0];
      entry.sn[0].xs[0][language] = value;
    }

    const semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT = /^semanticDomain\d*$/; // semanticDomain, semanticDomain2, semanticDomain<#>, but not semanticDomain_custom
    if (semanticDomain_FOLLOWED_BY_OPTIONAL_DIGIT.test(key)) {
      if (!entry.sn[0].sdn) entry.sn[0].sdn = [];

      entry.sn[0].sdn.push(value.toString());
    }
  }

  if (Object.keys(entry.sn[0].xs).length === 0) {
    delete entry.sn[0].xs;
  }

  if (!dateStamp) return entry;

  entry.ii = `v4-${dateStamp}`;
  entry.ca = timestamp as Timestamp;
  entry.ua = timestamp as Timestamp;

  return entry;
}

export function returnArrayFromCommaSeparatedItems(string: string): string[] {
  return string?.split(',').map((item) => item.trim()) || [];
}

import type { ActualDatabaseEntry } from '@living-dictionaries/types';
import type { Timestamp } from 'firebase/firestore';
import type { SenseColumns } from '@living-dictionaries/site/src/lib/supabase/change/types.js';
import { randomUUID } from 'crypto';
import { supabase } from '../config-supabase';

interface StandartData {
  row: Record<string, string>;
  dateStamp?: number;
  // eslint-disable-next-line no-undef
  timestamp?: FirebaseFirestore.FieldValue;
}

interface SenseData {
  entry_id: string;
  dictionary_id: string;
}

export function convertJsonRowToEntryFormat(
  standart: StandartData,
  senseData?: SenseData
): ActualDatabaseEntry {
  const { row, dateStamp, timestamp } = standart;
  const entry: ActualDatabaseEntry = { lx: row.lexeme, gl: {}, xs: {} };
  const sense_regex = /^s\d+_/;
  let glossObject:Record<string, any> = {};
  let row_id = randomUUID();
  let old_key = 2;

  if (row.phonetic) entry.ph = row.phonetic;
  if (row.morphology) entry.mr = row.morphology;
  if (row.interlinearization) entry.in = row.interlinearization;
  if (row.partOfSpeech) entry.ps = returnArrayFromCommaSeparatedItems(row.partOfSpeech);
  if (row.dialect) entry.di = row.dialect;
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
    if (key.includes('_gloss') && !sense_regex.test(key)) {
      const [language] = key.split('_gloss');
      entry.gl[language] = value;
    }

    if (key.includes('vernacular_exampleSentence')) {
      entry.xs.vn = value;
      continue; // to keep next block from also adding
    }

    // example sentence fields are codes followed by '_exampleSentence'
    if (key.includes('_exampleSentence')) {
      const [language] = key.split('_exampleSentence');
      entry.xs[language] = value;
    }

    if (senseData) {
      const { entry_id, dictionary_id } = senseData;
      if (sense_regex.test(key)) {
        if (key.includes('_gloss')) {
          let language_key = key.replace(sense_regex, '');
          language_key = language_key.replace('_gloss', '');

          if (key === `s${old_key}_${language_key}_gloss`) {
            glossObject[language_key] = row[key];
          } else {
            old_key++;
            row_id = randomUUID();
            glossObject = {};
            glossObject[language_key] = row[key];
          }
          addAdditionalSensesToSupabase(entry_id, dictionary_id, glossObject, 'glosses', row_id);
        }
      }
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

export async function addAdditionalSensesToSupabase(entry_id: string, dictionary_id: string, value: any, column: SenseColumns, row: string) {
  try {
    const { data, error } = await supabase
      .from('entry_updates')
      .insert([
        {
          user_id: 'diego@livingtongues.org',
          id: randomUUID(),
          dictionary_id,
          entry_id,
          table: 'senses',
          column,
          row,
          new_value: value,
        },
      ])
      .select();

    if (error) {
      console.error('Error inserting into Supabase: ', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error: ', error);
  }
}

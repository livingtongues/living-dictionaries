import type { ExpandedEntry } from '@living-dictionaries/types';
import { glossingLanguages } from '$lib/glosses/glossing-languages';
import type { EntryForCSV } from './prepareEntriesForCsv';

export function assign_local_orthographies_as_headers(
  alternate_orthographies: string[]
): EntryForCSV {
  const headers: EntryForCSV = {};

  if (alternate_orthographies) {
    alternate_orthographies.forEach((lo, index) => {
      headers[`local_orthography_${index + 1}`] = lo;
    });
  }

  return headers;
}

export function assign_semantic_domains_as_headers(
  max_semantic_domain_number: number
): EntryForCSV {
  const headers = {};
  if (max_semantic_domain_number > 0) {
    for (let index = 0; index < max_semantic_domain_number; index++) {
      headers[`semantic_domain_${index + 1}`] = `Semantic domain ${index + 1}`;
    }
  }
  return headers;
}

export function count_maximum_semantic_domains_only_from_first_senses(
  entries: ExpandedEntry[]
): number {
  const max_semantic_domain_number = Math.max(
    ...entries.map((entry) => entry.senses?.[0]?.semantic_domains?.length || 0)
  );
  return max_semantic_domain_number;
}

export function assign_gloss_languages_as_headers(gloss_languages: string[]): EntryForCSV {
  const headers = {};
  if (gloss_languages) {
    gloss_languages.forEach((bcp) => {
      headers[`${bcp}_gloss_language`] = `${glossingLanguages[bcp].vernacularName || bcp} Gloss`;
    });
  }
  return headers;
}

export function assign_example_sentences_as_headers(
  gloss_languages: string[],
  dictionary_name: string
): EntryForCSV {
  const headers = {};
  headers['vernacular_example_sentence'] = `Example sentence in ${dictionary_name}`;
  if (gloss_languages) {
    gloss_languages.forEach((bcp) => {
      headers[`${bcp}_example_sentence`] = `Example sentence in ${
        glossingLanguages[bcp].vernacularName || bcp
      }`;
    });
  }
  return headers;
}

import type { ExpandedEntry } from '@living-dictionaries/types';
import { glossingLanguages } from '$lib/glosses/glossing-languages';
import type { EntryForCSV } from './prepareEntriesForCsv';

export function assign_local_orthographies_to_headers(
  headers: EntryForCSV,
  alternate_orthographies: string[]
): void {
  if (alternate_orthographies) {
    alternate_orthographies.forEach((lo, index) => {
      headers[`local_orthography_${index + 1}`] = lo;
    });
  }
}

export function assign_semantic_domains_to_headers(
  headers: EntryForCSV,
  max_semantic_domain_number: number
): void {
  if (max_semantic_domain_number > 0) {
    for (let index = 0; index < max_semantic_domain_number; index++) {
      headers[`semantic_domain_${index + 1}`] = `Semantic domain ${index + 1}`;
    }
  }
}

export function count_maximum_semantic_domains_only_from_first_senses(
  entries: ExpandedEntry[]
): number {
  const max_semantic_domain_number = Math.max(
    ...entries.map((entry) => entry.senses?.[0]?.semantic_domains?.length || 0)
  );
  return max_semantic_domain_number;
}

export function assign_gloss_languages_to_headers(
  headers: EntryForCSV,
  gloss_languages: string[]
): void {
  if (gloss_languages) {
    gloss_languages.forEach((bcp) => {
      headers[`${bcp}_gloss_language`] = `${glossingLanguages[bcp].vernacularName || bcp} Gloss`;
    });
  }
}

export function assign_example_sentences_to_headers(
  headers: EntryForCSV,
  gloss_languages: string[],
  dictionary_name: string
): void {
  headers.vernacular_example_sentence = `Example sentence in ${dictionary_name}`;
  if (gloss_languages) {
    gloss_languages.forEach((bcp) => {
      headers[`${bcp}_example_sentence`] = `Example sentence in ${
        glossingLanguages[bcp].vernacularName || bcp
      }`;
    });
  }
}

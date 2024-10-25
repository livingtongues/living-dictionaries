// import type { ExpandedEntry } from '@living-dictionaries/types';
// import { glossingLanguages } from '$lib/glosses/glossing-languages';
// import type { EntryForCSV } from './prepareEntriesForCsv';

// export function get_local_orthography_headers(
//   alternate_orthographies: string[]
// ): EntryForCSV {
//   const headers: EntryForCSV = {};
//   if (alternate_orthographies) {
//     alternate_orthographies.forEach((lo, index) => {
//       headers[`local_orthography_${index + 1}`] = lo;
//     });
//   }
//   return headers;
// }

// export function get_semantic_domain_headers(entries: ExpandedEntry[]): EntryForCSV {
//   const headers = {};

//   const max_semantic_domains = Math.max(
//     ...entries.map((entry) => entry.senses?.[0]?.translated_ld_semantic_domains?.length || 0)
//   );

//   if (max_semantic_domains > 0) {
//     for (let index = 0; index < max_semantic_domains; index++)
//       headers[`semantic_domain_${index + 1}`] = `Semantic domain ${index + 1}`;
//   }
//   return headers;
// }

// export function get_gloss_language_headers(gloss_languages: string[]): EntryForCSV {
//   const headers = {};
//   if (gloss_languages) {
//     gloss_languages.forEach((bcp) => {
//       headers[`${bcp}_gloss_language`] = `${glossingLanguages[bcp].vernacularName || bcp} Gloss`;
//     });
//   }
//   return headers;
// }

// export function get_example_sentence_headers(
//   gloss_languages: string[],
//   dictionary_name: string
// ): EntryForCSV {
//   const headers: EntryForCSV = {};
//   headers.vernacular_example_sentence = `Example sentence in ${dictionary_name}`;
//   if (gloss_languages) {
//     gloss_languages.forEach((bcp) => {
//       headers[`${bcp}_example_sentence`] = `Example sentence in ${
//         glossingLanguages[bcp].vernacularName || bcp
//       }`;
//     });
//   }
//   return headers;
// }

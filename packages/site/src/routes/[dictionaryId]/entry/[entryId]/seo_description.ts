import type { IEntry } from '@living-dictionaries/types';
import { order_glosses } from '$lib/helpers/glosses';
import { add_periods_and_comma_separate_parts_of_speech } from "$lib/helpers/entry/add_periods_and_comma_separate_parts_of_speech";
import { remove_italic_tags } from '$lib/helpers/remove_italic_tags';
import { get_local_orthographies } from '$lib/helpers/entry/get_local_orthagraphies';

export function seo_description(
  entry: Partial<IEntry>,
  dictionary_gloss_languages: string[],
  $t: (key: string) => string
) {

  const local_orthographies = get_local_orthographies(entry).join(', ');
  const phonetic = entry.ph && `[${entry.ph}]`;
  const parts_of_speech = add_periods_and_comma_separate_parts_of_speech(entry.ps);

  const ordered_and_labeled_glosses = order_glosses({
    glosses: entry.gl,
    dictionary_gloss_languages,
    $t,
    label: true,
  }).join(', ')
  const glosses = remove_italic_tags(ordered_and_labeled_glosses);

  const dialect = entry?.di || '';

  const items_for_description = [local_orthographies, phonetic, parts_of_speech, glosses, dialect];
  const items_with_values = items_for_description.filter(item => item);
  const trimmed_items = items_with_values.map(item => item.trim());
  return trimmed_items.join(', ');
}

// why are there line breaks in the data? Is this needed?
// const lineBreaksIncludingOptionalPreceedingWhitespaceRegex = /\s*?\n/g;
// export function removeLineBreaks(text: string): string {
//   return text.replace(lineBreaksIncludingOptionalPreceedingWhitespaceRegex, ' ').trim();
// }

import type { EntryView, Tables } from '@living-dictionaries/types'
import { order_glosses } from '$lib/helpers/glosses'
import { add_periods_and_comma_separate_parts_of_speech } from '$lib/helpers/entry/add_periods_and_comma_separate_parts_of_speech'
import { remove_italic_tags } from '$lib/helpers/remove_italic_tags'
import { get_local_orthographies } from '$lib/helpers/entry/get_local_orthagraphies'
import type { TranslateFunction } from '$lib/i18n/types'

export function seo_description({ entry, gloss_languages, t, dialects }: {
  entry: Partial<EntryView>
  gloss_languages: string[]
  t: TranslateFunction
  dialects: Tables<'dialects'>[]
},
) {
  const local_orthographies = get_local_orthographies(entry.main.lexeme).join(', ')
  const phonetic = entry.main.phonetic && `[${entry.main.phonetic}]`
  const parts_of_speech = add_periods_and_comma_separate_parts_of_speech(entry.senses?.[0].parts_of_speech) // TODO: use all senses and use parts of speech abbrevs for current language once routing allows for that

  const ordered_and_labeled_glosses = order_glosses({
    glosses: entry.senses?.[0].glosses,
    // glosses: entry.senses.map(sense => sense.glosses).flat(), // TODO: use all senses
    dictionary_gloss_languages: gloss_languages,
    t,
    label: true,
  }).join(', ')
  const glosses = remove_italic_tags(ordered_and_labeled_glosses)
  const dialect_string = dialects.filter(dialect => entry.dialect_ids.includes(dialect.id)).map(dialect => dialect.name.default).join(', ') || ''
  const items_for_description = [local_orthographies, phonetic, parts_of_speech, glosses, dialect_string]
  const items_with_values = items_for_description.filter(item => item)
  const trimmed_items = items_with_values.map(item => item.trim())
  return trimmed_items.join(', ')
}

// why are there line breaks in the data? Is this needed?
// const lineBreaksIncludingOptionalPreceedingWhitespaceRegex = /\s*?\n/g;
// export function removeLineBreaks(text: string): string {
//   return text.replace(lineBreaksIncludingOptionalPreceedingWhitespaceRegex, ' ').trim();
// }

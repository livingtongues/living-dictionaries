import type { IColumn, Tables } from '$lib/types'
import { page } from '$app/state'
import { vernacular_name } from '$lib/gloss/vernacular-name'
import { get_orthographies } from '$lib/orthography/orthographies'
import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants'
import { browser } from '$app/environment'

export function set_up_columns(columns: IColumn[], dictionary: Tables<'dictionaries'>): IColumn[] {
  const columns_with_definition = [...columns]
  if (!columns_with_definition.some(column => column.field === 'definition')) {
    const gloss_index = columns_with_definition.findIndex(column => column.field === 'gloss')
    const definition_index = gloss_index >= 0 ? gloss_index + 1 : columns_with_definition.length
    columns_with_definition.splice(definition_index, 0, { field: 'definition', width: 300 })
  }

  // Pre-rename persisted prefs lack a variant column — inject so variant dictionaries keep it.
  if (!columns_with_definition.some(column => column.field === 'variant'))
    columns_with_definition.push({ field: 'variant', width: 150 })

  const cols = columns_with_definition.filter((column) => {
    // Variant defaults per-dictionary (shown where variant data is a known workflow); an
    // explicit user toggle (true/false) always wins.
    if (column.field === 'variant')
      return !(column.hidden ?? !DICTIONARIES_WITH_VARIANTS.includes(dictionary.id))
    return !column.hidden
  })

  const gloss_index = cols.findIndex(col => col.field === 'gloss')
  if (browser && gloss_index >= 0) {
    const { data } = page
    const gloss_columns: IColumn[] = []
    dictionary.gloss_languages.forEach((bcp) => {
      gloss_columns.push({
        field: 'gloss',
        bcp,
        width: cols[gloss_index].width,
        sticky: cols[gloss_index].sticky || false,
        display: data?.t({ dynamicKey: `gl.${bcp}`, fallback: bcp }),
        explanation: vernacular_name(bcp),
      })
    })
    cols.splice(gloss_index, 1, ...gloss_columns)
  }

  const definition_index = cols.findIndex(column => column.field === 'definition')
  if (browser && definition_index >= 0) {
    const { data } = page
    const definition_columns: IColumn[] = []
    dictionary.gloss_languages.forEach((bcp) => {
      definition_columns.push({
        field: 'definition',
        bcp,
        width: cols[definition_index].width,
        sticky: cols[definition_index].sticky || false,
        display: `${data?.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })} ${data?.t('entry_field.definition')}`,
        explanation: vernacular_name(bcp),
      })
    })
    cols.splice(definition_index, 1, ...definition_columns)
  }

  const example_sentence_index = cols.findIndex(col => col.field === 'example_sentence')
  if (browser && example_sentence_index >= 0) {
    const { data } = page
    const example_sentence_columns: IColumn[] = [
      {
        field: 'example_sentence',
        bcp: 'vn', // vernacular
        width: cols[example_sentence_index].width,
        sticky: cols[example_sentence_index].sticky || false,
        display: data?.t('entry_field.example_sentence'),
      },
    ]
    dictionary.gloss_languages.forEach((bcp) => {
      example_sentence_columns.push({
        field: 'example_sentence',
        bcp,
        width: cols[example_sentence_index].width,
        sticky: cols[example_sentence_index].sticky || false,
        display: `${data?.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })} ${data?.t('entry_field.example_sentence')}`,
      })
    })
    cols.splice(example_sentence_index, 1, ...example_sentence_columns)
  }

  const orthography_index = cols.findIndex(({ field }) => field === 'local_orthography')
  if (orthography_index >= 0) {
    const alternate_orthography_columns: IColumn[] = []
    for (const orthography of get_orthographies(dictionary).alternates) {
      alternate_orthography_columns.push({
        field: 'local_orthography',
        width: 170,
        display: orthography.name,
        orthography_code: orthography.code,
        bcp: orthography.bcp,
      })
    }
    cols.splice(orthography_index, 1, ...alternate_orthography_columns)
  }

  return cols
}

import type { IColumn, Tables } from '@living-dictionaries/types'
import { get } from 'svelte/store'
import { page } from '$app/stores'
import { vernacularName } from '$lib/helpers/vernacularName'
import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants'
import { browser } from '$app/environment'

export function setUpColumns(columns: IColumn[], dictionary: Tables<'dictionaries'>): IColumn[] {
  const cols = columns.filter(column => !column.hidden)

  const glossIndex = cols.findIndex(col => col.field === 'gloss')
  if (browser && glossIndex >= 0) {
    const { data } = get(page)
    const glossColumns: IColumn[] = []
    dictionary.gloss_languages.forEach((bcp) => {
      glossColumns.push({
        field: 'gloss',
        bcp,
        width: cols[glossIndex].width,
        sticky: cols[glossIndex].sticky || false,
        display: data?.t({ dynamicKey: `gl.${bcp}`, fallback: bcp }),
        explanation: vernacularName(bcp),
      })
    })
    cols.splice(glossIndex, 1, ...glossColumns)
  }

  const exampleSentenceIndex = cols.findIndex(col => col.field === 'example_sentence')
  if (browser && exampleSentenceIndex >= 0) {
    const { data } = get(page)
    const exampleSentenceColumns: IColumn[] = [
      {
        field: 'example_sentence',
        bcp: 'vn', // vernacular
        width: cols[exampleSentenceIndex].width,
        sticky: cols[exampleSentenceIndex].sticky || false,
        display: data?.t('entry_field.example_sentence'),
      },
    ]
    dictionary.gloss_languages.forEach((bcp) => {
      exampleSentenceColumns.push({
        field: 'example_sentence',
        bcp,
        width: cols[exampleSentenceIndex].width,
        sticky: cols[exampleSentenceIndex].sticky || false,
        display: `${data?.t({ dynamicKey: `gl.${bcp}`, fallback: bcp })} ${data?.t('entry_field.example_sentence')}`,
      })
    })
    cols.splice(exampleSentenceIndex, 1, ...exampleSentenceColumns)
  }

  const orthographyIndex = cols.findIndex(({ field }) => field === 'local_orthography')
  if (orthographyIndex >= 0) {
    const alternateOrthographyColumns: IColumn[] = []
    if (dictionary.orthographies) {
      for (const [index, orthography] of dictionary.orthographies.entries()) {
        alternateOrthographyColumns.push({
          field: 'local_orthography',
          width: 170,
          display: orthography.name.default,
          orthography_index: index + 1,
        })
      }
    }
    cols.splice(orthographyIndex, 1, ...alternateOrthographyColumns)
  }

  if (DICTIONARIES_WITH_VARIANTS.includes(dictionary.id))
    cols.push({ field: 'variant', width: 150 })

  return cols
}

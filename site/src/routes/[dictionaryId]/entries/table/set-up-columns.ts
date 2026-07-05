import type { IColumn, Tables } from '$lib/types'
import { page } from '$app/state'
import { vernacularName } from '$lib/helpers/vernacular-name'
import { get_orthographies } from '$lib/helpers/orthographies'
import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants'
import { browser } from '$app/environment'

export function setUpColumns(columns: IColumn[], dictionary: Tables<'dictionaries'>): IColumn[] {
  const cols = columns.filter(column => !column.hidden)

  const glossIndex = cols.findIndex(col => col.field === 'gloss')
  if (browser && glossIndex >= 0) {
    const { data } = page
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
    const { data } = page
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
    for (const orthography of get_orthographies(dictionary).alternates) {
      alternateOrthographyColumns.push({
        field: 'local_orthography',
        width: 170,
        display: orthography.name,
        orthography_code: orthography.code,
        bcp: orthography.bcp,
      })
    }
    cols.splice(orthographyIndex, 1, ...alternateOrthographyColumns)
  }

  if (DICTIONARIES_WITH_VARIANTS.includes(dictionary.id))
    cols.push({ field: 'variant', width: 150 })

  return cols
}

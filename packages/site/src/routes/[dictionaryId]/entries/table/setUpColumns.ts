import type { IColumn, IDictionary } from '@living-dictionaries/types';
import { get } from 'svelte/store';
import { page } from '$app/stores';
import { vernacularName } from '$lib/helpers/vernacularName';
import { DICTIONARIES_WITH_VARIANTS } from '$lib/constants';

export function setUpColumns(columns: IColumn[], dictionary: IDictionary): IColumn[] {
  const cols = columns.filter((column) => !column.hidden);

  const glossIndex = cols.findIndex((col) => col.field === 'gloss');
  if (glossIndex >= 0) {
    const { data: { t } } = get(page)
    const glossColumns: IColumn[] = [];
    dictionary.glossLanguages.forEach((bcp) => {
      glossColumns.push({
        field: 'gloss',
        bcp,
        width: cols[glossIndex].width,
        sticky: cols[glossIndex].sticky || false,
        display: t('gl.' + bcp),
        explanation: vernacularName(bcp),
      });
    });
    cols.splice(glossIndex, 1, ...glossColumns);
  }

  const exampleSentenceIndex = cols.findIndex((col) => col.field === 'example_sentence');
  if (exampleSentenceIndex >= 0) {
    const { data: { t } } = get(page)
    const exampleSentenceColumns: IColumn[] = [
      {
        field: 'example_sentence',
        bcp: 'vn', // vernacular
        width: cols[exampleSentenceIndex].width,
        sticky: cols[exampleSentenceIndex].sticky || false,
        display: t('entry.example_sentence'),
      },
    ];
    dictionary.glossLanguages.forEach((bcp) => {
      exampleSentenceColumns.push({
        field: 'example_sentence',
        bcp,
        width: cols[exampleSentenceIndex].width,
        sticky: cols[exampleSentenceIndex].sticky || false,
        display: `${t(`gl.${bcp}`)} ${t('entry.example_sentence')}`,
      });
    });
    cols.splice(exampleSentenceIndex, 1, ...exampleSentenceColumns);
  }

  const orthographyIndex = cols.findIndex(({field}) => field === 'local_orthography');
  if (orthographyIndex >= 0) {
    const alternateOrthographyColumns: IColumn[] = [];
    if (dictionary.alternateOrthographies) {
      for (const [index, orthography] of dictionary.alternateOrthographies.entries()) {
        alternateOrthographyColumns.push({
          field: 'local_orthography',
          width: 170,
          display: orthography,
          orthography_index: index + 1,
        });
      }
    }
    cols.splice(orthographyIndex, 1, ...alternateOrthographyColumns);
  }

  if (DICTIONARIES_WITH_VARIANTS.includes(dictionary.id))
    cols.push({ field: 'variant', width: 150 });

  return cols;
}

import type { IColumn, IDictionary } from '@living-dictionaries/types';
import { get } from 'svelte/store';
import { t } from 'svelte-i18n';
import { vernacularName } from '$lib/helpers/vernacularName';

export function setUpColumns(columns: IColumn[], dictionary: IDictionary): IColumn[] {
  const cols = columns.filter((column) => !column.hidden);

  const glossIndex = cols.findIndex((col) => col.field === 'gloss');
  if (glossIndex >= 0) {
    const $t = get(t);
    const glossColumns: IColumn[] = [];
    dictionary.glossLanguages.forEach((bcp) => {
      glossColumns.push({
        field: bcp,
        width: cols[glossIndex].width,
        sticky: cols[glossIndex].sticky || false,
        display: $t('gl.' + bcp),
        explanation: vernacularName(bcp),
        gloss: true,
      });
    });
    cols.splice(glossIndex, 1, ...glossColumns);
  }

  const exampleSentenceIndex = cols.findIndex((col) => col.field === 'example_sentence');
  if (exampleSentenceIndex >= 0) {
    const $t = get(t);
    const exampleSentenceColumns: IColumn[] = [
      {
        field: 'xv',
        width: cols[exampleSentenceIndex].width,
        sticky: cols[exampleSentenceIndex].sticky || false,
        display: $t('entry.example_sentence', { default: 'Example Sentence' }),
        exampleSentence: true,
      },
    ];
    dictionary.glossLanguages.forEach((bcp) => {
      exampleSentenceColumns.push({
        field: bcp,
        width: cols[exampleSentenceIndex].width,
        sticky: cols[exampleSentenceIndex].sticky || false,
        display: `${$t(`gl.${bcp}`)} ${$t('entry.example_sentence', {
          default: 'Example Sentence',
        })}`,
        exampleSentence: true,
      });
    });
    cols.splice(exampleSentenceIndex, 1, ...exampleSentenceColumns);
  }

  const orthographyIndex = cols.findIndex((col) => col.field === 'alternateOrthographies');
  if (orthographyIndex >= 0) {
    const alternateOrthographyColumns: IColumn[] = [];
    if (dictionary.alternateOrthographies) {
      for (const [index, orthography] of dictionary.alternateOrthographies.entries()) {
        alternateOrthographyColumns.push({
          field: index === 0 ? 'lo' : 'lo' + (index + 1),
          width: 170,
          display: orthography,
          orthography: true,
        });
      }
    }
    cols.splice(orthographyIndex, 1, ...alternateOrthographyColumns);
  }

  return cols;
}

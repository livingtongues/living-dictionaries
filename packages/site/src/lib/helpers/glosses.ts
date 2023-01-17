import type { IGloss } from '@living-dictionaries/types';

export function printGlosses(
  glosses: IGloss,
  glossOrder: string[],
  t: (id: string) => string,
  { shorten = false } = {}
) {
  const glossesMergedWithoutDuplicates = new Set([...glossOrder, ...Object.keys(glosses)]); //glossOrder must be in first place to sort correctly
  const SortedGlossesArray = Array.from(glossesMergedWithoutDuplicates);
  return SortedGlossesArray.filter((bcp) => glosses[bcp]).map((bcp) => {
    const gloss = glosses[bcp];
    if (shorten) return gloss;
    return `${t('gl.' + bcp)}: ${gloss}`;
  });
}

if (import.meta.vitest) {
  const t = (id) => {
    switch (id) {
      case 'gl.de':
        return 'German';
      case 'gl.en':
        return 'English';
      case 'gl.es':
        return 'Spanish';
      default:
        return 'other';
    }
  };
  test('printGlosses', () => {
    const gloss = {
      en: 'apple',
      es: 'manzana',
      scientific: '<i>Neolamarckia cadamba</i>',
      empty: '',
      null: null,
      de: 'apfel',
    };
    const glossOrderInDictionary = ['de', 'es', 'en'];
    expect(printGlosses(gloss, glossOrderInDictionary, t, { shorten: true })).toMatchInlineSnapshot(
      `
      [
        "apfel",
        "manzana",
        "apple",
        "<i>Neolamarckia cadamba</i>",
      ]
    `
    );

    expect(printGlosses(gloss, glossOrderInDictionary, t)).toMatchInlineSnapshot(`
      [
        "German: apfel",
        "Spanish: manzana",
        "English: apple",
        "other: <i>Neolamarckia cadamba</i>",
      ]
    `);

    expect(
      printGlosses(gloss, glossOrderInDictionary, t, { shorten: true })
        .join(', ')
        .replace(/<\/?i>/g, '') + '.'
    ).toMatchInlineSnapshot('"apfel, manzana, apple, Neolamarckia cadamba."');

    expect(printGlosses({}, glossOrderInDictionary, t)).toMatchInlineSnapshot('[]');
  });
}

export function showEntryGlossLanguages(
  entryGlosses: { [key: string]: string },
  dictionaryLanguages: string[]
) {
  if (entryGlosses) {
    return [...new Set([...dictionaryLanguages, ...Object.keys(entryGlosses)])];
  }
  return [...new Set(dictionaryLanguages)];
}

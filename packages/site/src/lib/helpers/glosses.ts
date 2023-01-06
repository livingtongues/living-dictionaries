import type { IGloss } from '@living-dictionaries/types';

export function printGlosses(glosses: IGloss, t: (id: string) => string, { shorten = false } = {}) {
  return Object.keys(glosses)
    .filter((bcp) => glosses[bcp])
    .sort() // sort by dictionary's gloss language order in the future
    .map((bcp) => {
      const gloss = glosses[bcp];
      if (shorten) return gloss;
      return `${t('gl.' + bcp)}: ${gloss}`;
    });
}

if (import.meta.vitest) {
  const t = (id) => (id === 'gl.en' ? 'English' : 'Spanish');
  test('printGlosses', () => {
    const gloss = {
      en: 'apple',
      es: 'arbol',
      scientific: '<i>Neolamarckia cadamba</i>',
      empty: '',
      null: null,
    };
    expect(printGlosses(gloss, t, { shorten: true })).toMatchInlineSnapshot(`
      [
        "apple",
        "arbol",
        "<i>Neolamarckia cadamba</i>",
      ]
    `);

    expect(printGlosses(gloss, t)).toMatchInlineSnapshot(`
    [
      "English: apple",
      "Spanish: arbol",
      "Spanish: <i>Neolamarckia cadamba</i>",
    ]
    `);

    expect(
      printGlosses(gloss, t, { shorten: true })
        .join(', ')
        .replace(/<\/?i>/g, '') + '.'
    ).toMatchInlineSnapshot('"apple, arbol, Neolamarckia cadamba."');

    expect(printGlosses({}, t)).toMatchInlineSnapshot('[]');
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

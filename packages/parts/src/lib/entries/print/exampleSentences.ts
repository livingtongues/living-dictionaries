import type { IExampleSentence } from '@living-dictionaries/types';

export function printExampleSentences(
  exampleSentences: IExampleSentence,
  t: (id: string) => string,
  { shorten = false } = {}
) {
  const sortedExampleSentences = Object.keys(exampleSentences)
    .filter((bcp) => exampleSentences[bcp])
    .sort((a, b) => sortAscendingWithVernacularFirst(a, b));
  return sortedExampleSentences.map((bcp) => {
    const exampleSentence = exampleSentences[bcp];
    if (shorten) return exampleSentence;
    return `${t('xs.' + bcp)}: ${exampleSentence}`;
  });
}

function sortAscendingWithVernacularFirst(a: string, b: string): number {
  if (a === 'vn') return -1;
  if (b === 'vn') return 1;

  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
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
      case 'gl.vn':
        return 'Vernacular';
      default:
        return 'undefined';
    }
  };
  test('printExampleSentences', () => {
    const exampleSentence = {
      es: 'El perro está caminando',
      en: 'The dog is walking',
      vn: '我很喜歡吃香蕉',
      de: 'der hund geht spazieren',
    };
    expect(printExampleSentences(exampleSentence, t, { shorten: true })).toMatchInlineSnapshot(`
      [
        "我很喜歡吃香蕉",
        "der hund geht spazieren",
        "The dog is walking",
        "El perro está caminando",
      ]
    `);

    expect(printExampleSentences(exampleSentence, t)).toMatchInlineSnapshot(`
      [
        "Vernacular: 我很喜歡吃香蕉",
        "German: der hund geht spazieren",
        "English: The dog is walking",
        "Spanish: El perro está caminando",
      ]
    `);

    expect(
      printExampleSentences(exampleSentence, t, { shorten: true }).join(', ')
    ).toMatchInlineSnapshot(
      '"我很喜歡吃香蕉, der hund geht spazieren, The dog is walking, El perro está caminando"'
    );

    expect(printExampleSentences({}, t)).toMatchInlineSnapshot('[]');
  });
}

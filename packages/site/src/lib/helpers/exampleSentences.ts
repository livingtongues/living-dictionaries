import type { IExampleSentence } from '@living-dictionaries/types';

export function printExampleSentences(
  exampleSentences: IExampleSentence,
  t: (id: string) => string,
  { shorten = false } = {}
) {
  let exampleSentencesCopy = { ...exampleSentences };
  exampleSentencesCopy = sortVernacularSentence(exampleSentencesCopy);
  const sortedExampleSentences = Object.keys(exampleSentencesCopy)
    .filter((bcp) => exampleSentencesCopy[bcp])
    .sort((a, b) => {
      if (a === b) return 0;
      if (a === 'vn') return -1;
      if (b === 'vn') return 1;

      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
  return sortedExampleSentences.map((bcp) => {
    const exampleSentence = exampleSentencesCopy[bcp];
    if (shorten) return exampleSentence;
    return `${t('gl.' + bcp)}: ${exampleSentence}`;
  });
}

function sortVernacularSentence(exampleSentences: IExampleSentence) {
  if (exampleSentences.vn) {
    const vernacularSentence = { vn: exampleSentences.vn };
    delete exampleSentences.vn;
    exampleSentences = Object.assign(vernacularSentence, exampleSentences);
  }
  return exampleSentences;
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
      vn: '我很喜歡吃香蕉',
      de: 'der hund geht spazieren',
      en: 'The dog is walking',
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

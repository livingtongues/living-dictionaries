import type { IExampleSentence } from '@living-dictionaries/types';

export function printExampleSentences(
  exampleSentences: IExampleSentence,
  t: (id: string) => string,
  shorten = false
) {
  return Object.keys(exampleSentences)
    .filter((bcp) => exampleSentences[bcp])
    .sort()
    .map((bcp) => {
      const exampleSentence = exampleSentences[bcp];
      if (shorten) return exampleSentence;
      return `${t('gl.' + bcp)}: ${exampleSentence}`;
    });
}

if (import.meta.vitest) {
  const t = (id) => (id === 'gl.en' ? 'English' : 'Spanish');
  test('printExampleSentences', () => {
    const exampleSentence = {
      en: 'The dog is walking',
      es: 'El perro está caminando',
    };
    expect(printExampleSentences(exampleSentence, t, true)).toMatchInlineSnapshot(`
      [
        "The dog is walking",
        "El perro está caminando",
      ]
    `);

    expect(printExampleSentences(exampleSentence, t)).toMatchInlineSnapshot(`
      [
        "English: The dog is walking",
        "Spanish: El perro está caminando",
      ]
    `);

    expect(printExampleSentences(exampleSentence, t, true).join(', ')).toMatchInlineSnapshot(
      '"The dog is walking, El perro está caminando"'
    );

    expect(printExampleSentences({}, t)).toMatchInlineSnapshot('[]');
  });
}

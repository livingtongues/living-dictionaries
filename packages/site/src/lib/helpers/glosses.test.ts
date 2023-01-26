import { orderEntryAndDictionaryGlossLanguages, orderGlosses } from './glosses';

describe('orderGlosses', () => {
  const $t = (id: string) => {
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

  const glosses = {
    en: 'apple',
    es: 'manzana',
    scientific: '<i>Neolamarckia cadamba</i>',
    empty: '',
    null: null,
    de: 'apfel',
  };
  const dictionaryGlossLanguages = ['de', 'es', 'en'];

  test('orders based on dictionaryGlossLanguages first', () => {
    expect(orderGlosses({ glosses, dictionaryGlossLanguages, $t })).toMatchInlineSnapshot(
      `
        [
          "apfel",
          "manzana",
          "apple",
          "<i>Neolamarckia cadamba</i>",
        ]
        `
    );
  });

  test('adds language label when label set to true', () => {
    expect(orderGlosses({ glosses, dictionaryGlossLanguages, $t, label: true }))
      .toMatchInlineSnapshot(`
      [
        "German: apfel",
        "Spanish: manzana",
        "English: apple",
        "other: <i>Neolamarckia cadamba</i>",
      ]
      `);
  });

  test('handles an empty glosses object', () => {
    expect(orderGlosses({ glosses: {}, dictionaryGlossLanguages, $t })).toMatchInlineSnapshot('[]');
  });

  test('example implementation with join and italics removal', () => {
    expect(
      orderGlosses({ glosses, dictionaryGlossLanguages, $t })
        .join(', ')
        .replace(/<\/?i>/g, '') + '.'
    ).toMatchInlineSnapshot('"apfel, manzana, apple, Neolamarckia cadamba."');
  });
});

describe('orderGlosses with multiple examples', () => {
  const $t = (id: string) => {
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
  const entries = [
    {
      gl: {
        en: 'apple',
        es: 'manzana',
        de: 'apfel',
      },
    },
    {
      gl: {
        en: 'banana',
        es: 'plátano',
        de: '',
      },
    },
    {
      gl: {
        en: '',
        es: '',
        de: '',
      },
    },
  ];
  const dictionaryGlossLanguages = ['de', 'es', 'en'];

  test('displays always the first available gloss', () => {
    expect(
      entries.map(
        (entry) =>
          orderGlosses({
            glosses: entry.gl,
            dictionaryGlossLanguages,
            $t,
          })[0]
      )
    ).toMatchInlineSnapshot(`
      [
        "apfel",
        "plátano",
        undefined,
      ]
    `);
  });
});

describe('orderEntryAndDictionaryGlossLanguages', () => {
  test('places dictionary gloss languages first, then leftovers from gloss object but does not duplicate', () => {
    expect(orderEntryAndDictionaryGlossLanguages({ es: '', en: '' }, ['en', 'de']))
      .toMatchInlineSnapshot(`
      [
        "en",
        "de",
        "es",
      ]
    `);
  });
});

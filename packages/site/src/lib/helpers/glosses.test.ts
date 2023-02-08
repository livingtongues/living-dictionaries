import { order_entry_and_dictionary_gloss_languages, order_glosses } from './glosses';
import { remove_italic_tags } from './remove_italic_tags';

describe('order_glosses', () => {
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
  const dictionary_gloss_languages = ['de', 'es', 'en'];

  test('orders based on dictionary_gloss_languages first', () => {
    expect(order_glosses({ glosses, dictionary_gloss_languages, $t })).toMatchInlineSnapshot(
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
    expect(order_glosses({ glosses, dictionary_gloss_languages, $t, label: true }))
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
    expect(order_glosses({ glosses: {}, dictionary_gloss_languages, $t })).toMatchInlineSnapshot(
      '[]'
    );
  });

  test('example implementation with join and italics removal', () => {
    expect(
      remove_italic_tags(order_glosses({ glosses, dictionary_gloss_languages, $t }).join(', '))
    ).toMatchInlineSnapshot('"apfel, manzana, apple, Neolamarckia cadamba"');
  });
});

describe('order_entry_and_dictionary_gloss_languages', () => {
  test('places dictionary gloss languages first, then leftovers from gloss object but does not duplicate', () => {
    expect(order_entry_and_dictionary_gloss_languages({ es: '', en: '' }, ['en', 'de']))
      .toMatchInlineSnapshot(`
      [
        "en",
        "de",
        "es",
      ]
    `);
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
  const dictionary_gloss_languages = ['de', 'es', 'en'];

  test('displays always the first available gloss', () => {
    expect(
      entries.map(
        (entry) =>
          order_glosses({
            glosses: entry.gl,
            dictionary_gloss_languages,
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

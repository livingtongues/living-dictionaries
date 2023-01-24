import { orderEntryAndDictionaryGlossLanguages, orderGlosses } from './glosses';
import { removeItalicTagsWithAPeriod } from '../../routes/[dictionaryId]/entry/[entryId]/seoDescription';

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
      removeItalicTagsWithAPeriod(
        orderGlosses({ glosses, dictionaryGlossLanguages, $t }).join(', ')
      )
    ).toMatchInlineSnapshot('"apfel, manzana, apple, Neolamarckia cadamba."');
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

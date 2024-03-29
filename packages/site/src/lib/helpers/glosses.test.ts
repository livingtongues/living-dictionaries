import { english_translate } from '$lib/i18n';
import { order_entry_and_dictionary_gloss_languages, order_glosses } from './glosses';
import { remove_italic_tags } from './remove_italic_tags';

describe(order_glosses, () => {
  const t = english_translate

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
    expect(order_glosses({ glosses, dictionary_gloss_languages, t })).toEqual([
      'apfel',
      'manzana',
      'apple',
      '<i>Neolamarckia cadamba</i>',
    ]);
  });

  test('adds language label when label set to true', () => {
    expect(order_glosses({ glosses, dictionary_gloss_languages, t, label: true }))
      .toEqual([
        'German: apfel',
        'Spanish: manzana',
        'English: apple',
        'scientific: <i>Neolamarckia cadamba</i>',
      ]);
  });

  test('handles an empty glosses object', () => {
    expect(order_glosses({ glosses: {}, dictionary_gloss_languages, t })).toEqual([]);
  });

  test('handles undefined glosses object', () => {
    expect(order_glosses({ glosses: undefined, dictionary_gloss_languages, t })).toEqual([]);
  });

  test('example implementation with join and italics removal', () => {
    expect(
      remove_italic_tags(
        order_glosses({ glosses, dictionary_gloss_languages, t }).join(', ')
      )
    ).toEqual('apfel, manzana, apple, Neolamarckia cadamba');
  });
});

describe(order_entry_and_dictionary_gloss_languages, () => {
  test('places dictionary gloss languages first, then leftovers from gloss object but does not duplicate', () => {
    expect(order_entry_and_dictionary_gloss_languages({ es: '', en: '' }, ['en', 'de']))
      .toEqual([
        'en',
        'de',
        'es',
      ]);
  });
});

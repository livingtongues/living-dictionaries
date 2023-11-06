import type { ExpandedEntry } from '@living-dictionaries/types';
import { seo_description } from './seo_description';

describe('seo_description', () => {
  const t = (id: string) => {
    switch (id) {
    case 'gl.en':
      return 'English';
    case 'gl.es':
      return 'Spanish';
    case 'gl.or':
      return 'Oriya';
    case 'gl.as':
      return 'Assamese';
    case 'gl.hi':
      return 'Hindi';
    case 'gl.fr':
      return 'French';
    case 'gl.de':
      return 'German';
    case 'gl.pt':
      return 'Portuguese';
    case 'gl.it':
      return 'Italian';
    default:
      return 'other';
    }
  };

  test('prints simple labeled english and spanish glosses', () => {
    const entry: Partial<ExpandedEntry> = {
      senses: [{
        glosses: { en: 'hello', es: 'hola' },
      }]
    };
    const dictionary_gloss_languages = ['es'];
    const result = seo_description(entry, dictionary_gloss_languages, t);
    expect(result).toMatchInlineSnapshot('"Spanish: hola, English: hello"');
  });

  test('properly orders glosses according to dictionary gloss languages order', () => {
    const entry: Partial<ExpandedEntry> = {
      senses: [{
        glosses: {
          en: 'goats',
          es: 'cabras',
          it: 'capre',
          pt: 'cabras',
          fr: 'chèvres',
          de: 'Ziegen',
          or: 'ଛେଳି ଗୁଡିକ',
          as: 'ছাগল কেইতা',
          hi: 'बकरियाँ',
        },
      }],
    };
    const dictionary_gloss_languages = ['hi', 'or', 'as', 'en', 'fr', 'es', 'it', 'de', 'pt'];
    const result = seo_description(entry, dictionary_gloss_languages, t);
    expect(result).toMatchInlineSnapshot('"Hindi: बकरियाँ, Oriya: ଛେଳି ଗୁଡିକ, Assamese: ছাগল কেইতা, English: goats, French: chèvres, Spanish: cabras, Italian: capre, German: Ziegen, Portuguese: cabras"');
  });

  test('places local orthographies first', () => {
    const entry: Partial<ExpandedEntry> = {
      local_orthography_1: 'امتحان',
      local_orthography_2: 'Ölçek',
      local_orthography_3: 'परीक्षा',
      local_orthography_4: '시험',
      local_orthography_5: 'מִבְחָן',
      senses: [{
        glosses: { en: 'test' },
      }],
    };
    const no_dictionary_gloss_languages = [];
    const result = seo_description(entry, no_dictionary_gloss_languages, t);
    expect(result).toMatchInlineSnapshot('"امتحان, Ölçek, परीक्षा, 시험, מִבְחָן, English: test"');
  });

  test('handles local orthagraphies, phonetic, glosses, parts of speech, and dialect', () => {
    const entry: Partial<ExpandedEntry> = {
      local_orthography_1: 'আৰচি',
      local_orthography_2: '𑃢𑃝𑃐𑃤',
      phonetic: 'arsi',
      senses: [{
        glosses: { or: 'କଳା ମୁହାଁ ମାଙ୍କଡ', as: 'ক’লা মুখ\'ৰ বান্দৰ', en: 'black faced monkey' },
        parts_of_speech_keys: ['n', 'adj'],
      }],
      dialects: ['West Bengal Sabar'],
    };
    const dictionary_gloss_languages = ['as', 'en', 'or', 'hi'];
    const result = seo_description(entry, dictionary_gloss_languages, t);
    expect(result).toMatchInlineSnapshot(
      '"আৰচি, 𑃢𑃝𑃐𑃤, [arsi], n., adj., Assamese: ক’লা মুখ\'ৰ বান্দৰ, English: black faced monkey, Oriya: କଳା ମୁହାଁ ମାଙ୍କଡ, West Bengal Sabar"'
    );
  });

  test('handles no gloss field', () => {
    const dictionary_gloss_languages = ['en'];
    const result = seo_description({ lexeme: 'foo' }, dictionary_gloss_languages, t);
    expect(result).toEqual('');
  });
});

// describe('removeLineBreaks', () => {
//   test('keeps one space between words when newlines come after a space', () => {
//     const phrase = 'This is \nand \nexample \nphrase.';
//     expect(removeLineBreaks(phrase)).toMatchInlineSnapshot('"This is and example phrase."');
//   });
//   test('adds space between words only split by newline', () => {
//     const phrase = 'Here is the first line\nand now the second line';
//     expect(removeLineBreaks(phrase)).toMatchInlineSnapshot(
//       '"Here is the first line and now the second line"'
//     );
//   });
// });

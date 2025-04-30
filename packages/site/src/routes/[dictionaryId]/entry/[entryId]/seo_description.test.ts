import type { DeepPartial } from 'kitbook'
import { seo_description } from './seo_description'
import { english_translate } from '$lib/i18n'
import type { EntryData } from '$lib/search/types'

describe('seo_description', () => {
  const t = english_translate

  test('prints simple labeled english and spanish glosses', () => {
    const entry: DeepPartial<EntryData> = {
      senses: [{
        glosses: { en: 'hello', es: 'hola' },
      }],
    }
    const gloss_languages = ['es']
    const result = seo_description({ entry, gloss_languages, t })
    expect(result).toMatchInlineSnapshot('"Spanish: hola, English: hello"')
  })

  test('properly orders glosses according to dictionary gloss languages order', () => {
    const entry: DeepPartial<EntryData> = {
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
    }
    const gloss_languages = ['hi', 'or', 'as', 'en', 'fr', 'es', 'it', 'de', 'pt']
    const result = seo_description({ entry, gloss_languages, t })
    expect(result).toMatchInlineSnapshot('"Hindi: बकरियाँ, Oriya: ଛେଳି ଗୁଡିକ, Assamese: ছাগল কেইতা, English: goats, French: chèvres, Spanish: cabras, Italian: capre, German: Ziegen, Portuguese: cabras"')
  })

  test('places local orthographies before glosses', () => {
    const entry: DeepPartial<EntryData> = {
      main: {
        lexeme: {
          lo1: 'امتحان',
          lo2: 'Ölçek',
          lo3: 'परीक्षा',
          lo4: '시험',
          lo5: 'מִבְחָן',
        },
      },
      senses: [{
        glosses: { en: 'test' },
      }],
    }
    const no_gloss_languages = []
    const result = seo_description({ entry, gloss_languages: no_gloss_languages, t })
    expect(result).toMatchInlineSnapshot('"امتحان, Ölçek, परीक्षा, 시험, מִבְחָן, English: test"')
  })

  test('handles local orthagraphies, phonetic, glosses, parts of speech, and dialect', () => {
    const entry: DeepPartial<EntryData> = {
      main: {
        lexeme: {
          lo1: 'আৰচি',
          lo2: '𑃢𑃝𑃐𑃤',
        },
        phonetic: 'arsi',
      },
      senses: [{
        glosses: { or: 'କଳା ମୁହାଁ ମାଙ୍କଡ', as: 'ক’লা মুখ\'ৰ বান্দৰ', en: 'black faced monkey' },
        parts_of_speech: ['n', 'adj'],
      }],
      dialects: [{ id: '1', name: { default: 'West Bengal Sabar' } }],
    }
    const gloss_languages = ['as', 'en', 'or', 'hi']
    const result = seo_description({ entry, gloss_languages, t })
    expect(result).toMatchInlineSnapshot(
      '"আৰচি, 𑃢𑃝𑃐𑃤, [arsi], n., adj., Assamese: ক’লা মুখ\'ৰ বান্দৰ, English: black faced monkey, Oriya: କଳା ମୁହାଁ ମାଙ୍କଡ, West Bengal Sabar"',
    )
  })

  test('handles no gloss field', () => {
    const gloss_languages = ['en']
    const result = seo_description({ entry: { main: { lexeme: { default: 'foo' } } }, gloss_languages, t })
    expect(result).toEqual('')
  })
})

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

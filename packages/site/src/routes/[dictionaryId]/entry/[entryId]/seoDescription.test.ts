import type { IEntry } from '@living-dictionaries/types';
import { removeLineBreaks, seoDescription } from './seoDescription';

describe('seoDescription', () => {
  const $t = (id: string) => {
    switch (id) {
      case 'gl.en':
        return 'English';
      case 'gl.es':
        return 'Spanish';
      case 'gl.or':
        return 'Assamese';
      case 'gl.as':
        return 'Oriya';
      case 'gl.hi':
        return 'Hindi';
      case 'gl.fr':
        return 'Oriya';
      case 'gl.de':
        return 'Oriya';
      case 'gl.pt':
        return 'Hindi';
      case 'gl.it':
        return 'Oriya';
      default:
        return 'other';
    }
  };

  test('Displays a basic entry', () => {
    const entry: IEntry = {
      lx: 'hi',
      gl: { en: 'hello', es: 'hola' },
    };
    const dictionaryGlossLanguages = ['es'];

    const result = seoDescription(entry, dictionaryGlossLanguages, $t);
    expect(result).toMatchInlineSnapshot('"Spanish: hola, English: hello."');
  });
  test('Displays an entry with multiples glosses', () => {
    const entry: IEntry = {
      lx: 'hi',
      gl: {
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
    };
    const dictionaryGlossLanguages = ['hi', 'or', 'as', 'en', 'fr', 'es', 'it', 'de', 'pt'];

    const result = seoDescription(entry, dictionaryGlossLanguages, $t);
    expect(result).toMatchInlineSnapshot('"Hindi: बकरियाँ, Assamese: ଛେଳି ଗୁଡିକ, Oriya: ছাগল কেইতা, English: goats, Oriya: chèvres, Spanish: cabras, Oriya: capre, Oriya: Ziegen, Hindi: cabras."');
  });
  test('Displays an entry with all local orthographies', () => {
    const entry: IEntry = {
      lx: 'test',
      lo: 'امتحان',
      lo2: 'Ölçek',
      lo3: 'परीक्षा',
      lo4: '시험',
      lo5: 'מִבְחָן',
      gl: null,
    };
    const result = seoDescription(entry, [], $t);
    expect(result).toMatchInlineSnapshot('"امتحان Ölçek परीक्षा 시험 מִבְחָן"');
  });
  test('Displays a complex entry', () => {
    const entry: IEntry = {
      lx: 'arsi',
      lo: 'আৰচি',
      lo2: '𑃢𑃝𑃐𑃤',
      ph: 'arsi',
      gl: { or: 'କଳା ମୁହାଁ ମାଙ୍କଡ', as: "ক’লা মুখ'ৰ বান্দৰ", en: 'black faced monkey' },
      ps: ['n', 'adj'],
      di: 'West Bengal Sabar',
    };
    const dictionaryGlossLanguages = ['as', 'en', 'or', 'hi'];
    const result = seoDescription(entry, dictionaryGlossLanguages, $t);
    expect(result).toMatchInlineSnapshot(
      '"আৰচি 𑃢𑃝𑃐𑃤, [arsi], n, adj., Oriya: ক’লা মুখ\'ৰ বান্দৰ, English: black faced monkey, Assamese: କଳା ମୁହାଁ ମାଙ୍କଡ., West Bengal Sabar"'
    );
  });
});

describe('removeLineBreaks', () => {
  test('keeps one space between words when newlines come after a space', () => {
    const phrase = 'This is \nand \nexample \nphrase.';
    expect(removeLineBreaks(phrase)).toMatchInlineSnapshot('"This is and example phrase."');
  });
  test('adds space between words only split by newline', () => {
    const phrase = 'Here is the first line\nand now the second line';
    expect(removeLineBreaks(phrase)).toMatchInlineSnapshot(
      '"Here is the first line and now the second line"'
    );
  });
});

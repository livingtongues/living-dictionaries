import type { IEntry } from '@living-dictionaries/types';
import { removeLineBreaks, seoDescription } from './seoDescription';

describe('seoDescription', () => {
  const $t = (id: string) => {
    switch (id) {
      case 'gl.en':
        return 'English';
      case 'gl.es':
        return 'Spanish';
      default:
        return 'other';
    }
  };

  test('just demoing to get things started... needs changed and many more tests added', () => {
    const entry: IEntry = {
      lx: 'hi',
      gl: { en: 'hello', es: 'hola' },
    };
    const dictionaryGlossLanguages = ['es'];

    const result = seoDescription(entry, dictionaryGlossLanguages, $t);
    expect(result).toMatchInlineSnapshot('"Spanish: hola, English: hello."');
  });
});


describe('removeLineBreaks', () => {
  test('keeps one space between words when newlines come after a space', () => {
    const phrase = 'This is \nand \nexample \nphrase.';
    expect(removeLineBreaks(phrase)).toMatchInlineSnapshot(
      '"This is and example phrase."'
    );
  });
  test('adds space between words only split by newline', () => {
    const phrase = 'Here is the first line\nand now the second line';
    expect(removeLineBreaks(phrase)).toMatchInlineSnapshot(
      '"Here is the first line and now the second line"'
    );
  });
});
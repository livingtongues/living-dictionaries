import type { IEntry } from "@living-dictionaries/types";
import { seoDescription } from "./seoDescription";

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
    }
    const dictionaryGlossLanguages = ['es'];

    const result = seoDescription(entry, dictionaryGlossLanguages, $t);
    expect(result).toMatchInlineSnapshot('"Spanish: hola, English: hello."');
  });
});
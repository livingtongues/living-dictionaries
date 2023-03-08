import * as fs from 'fs';
import { test_words } from './test_words';
import { test_tones } from './test_tones';
import { bum_phonetics } from './bum_phonetics';
import { bum_tones } from './bum_tones';
//TODO previously change L H LH and HL characters for unicode accents, check test_tones.ts example
// \u030C = ˇ (hacek)
// \u0300 = ` (Grave accent)
// \u0301 = ´ (Acute accent)
// \u0302 = ˆ (Circumflex accent)

const bum_vowels = new Set(['a', 'e', 'i', 'o', 'u', 'ɛ', 'ə', 'ɔ', 'ɨ']);

function count_vowels(word: string, vowels: Set<string>): number {
  let number_of_vowels = 0;
  word.split('').forEach((letter) => {
    if (vowels.has(letter)) {
      number_of_vowels += 1;
    }
  });
  return number_of_vowels;
}

function add_tones_to_word(word: string, accents: string): string {
  if (accents === '') {
    return word;
  }
  let new_word = '';
  let accent_index = 0;
  const splitted_accents = accents.split(' ');
  const splitted_word = word.split('');
  //TODO console errors instead of throwing them to continue script?
  splitted_word.forEach((letter, letter_index) => {
    let new_letter;
    if (bum_vowels.has(letter) && !bum_vowels.has(splitted_word[letter_index - 1])) {
      if (!splitted_accents[accent_index]) {
        throw new Error(`There's not enough accents in word: ${word}`);
      }
      new_letter = `${letter}${splitted_accents[accent_index]}`;
      accent_index += 1;
    } else {
      new_letter = letter;
    }

    new_word += new_letter;
  });
  if (accent_index != splitted_accents.length) {
    throw new Error(`There's more accents than vowels in word: ${word}`);
  }
  return new_word;
}

function integrate_tones_to_bum_phonetics(
  phonetics: string[],
  tones: string[],
  path: string
): void {
  const new_phonetics: string[] = [];
  if (phonetics.length !== tones.length) {
    throw new Error('Tones and phonetics have to correspond to each other');
  }
  phonetics.forEach((word, i) => {
    new_phonetics.push(add_tones_to_word(word, tones[i]));
  });
  fs.writeFile(path, new_phonetics.join('\n'), (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log('File written successfully!');
  });
}

// integrate_tones_to_bum_phonetics(bum_phonetics, bum_tones, './spreadsheet_helpers/bum_result.txt');

if (import.meta.vitest) {
  describe('count_vowels', () => {
    test.each([
      {
        word: 'ts',
        vowels: new Set(['a']),
        expected: 0,
      },
      {
        word: 'solo',
        vowels: new Set(['o']),
        expected: 2,
      },
      {
        word: 'acento',
        vowels: new Set(['a', 'e', 'o']),
        expected: 3,
      },
    ])('counting vowels on different words', ({ word, vowels, expected }) => {
      expect(count_vowels(word, vowels)).toEqual(expected);
    });
  });

  describe('add_tones_to_word', () => {
    test.each([
      {
        word: 'abeto',
        accents: '\u030C \u0302 \u0300',
        expected: 'ǎbêtò',
      },
      {
        word: 'kɔtɛchafɨ',
        accents: '\u0300 \u0301 \u0302 \u030C',
        expected: 'kɔ̀tɛ́châfɨ̌',
      },
      {
        word: 'pə',
        accents: '\u0302',
        expected: 'pə̂',
      },
      {
        word: 'pe-tɔ',
        accents: '\u0300 \u0300',
        expected: 'pè-tɔ̀',
      },
    ])('adds tones to vowels in different words', ({ word, accents, expected }) => {
      expect(add_tones_to_word(word, accents)).toEqual(expected);
    });

    test.each([
      {
        word: 'soiloc',
        accents: '\u0302 \u0301',
        expected: 'sôilóc',
      },
      {
        word: 'iɔtɛə',
        accents: '\u0300 \u0301',
        expected: 'ìɔtɛ́ə',
      },
    ])('adds tones to diphthongs in different words', ({ word, accents, expected }) => {
      expect(add_tones_to_word(word, accents)).toEqual(expected);
    });

    test('more accents than vowels', () => {
      const word = 'təst';
      const accents = '\u0302 \u0301';
      expect(() => add_tones_to_word(word, accents)).toThrowError(
        "There's more accents than vowels"
      );
    });

    test('more vowels than accents', () => {
      const word = 'potɨ';
      const accents = '\u0300';
      expect(() => add_tones_to_word(word, accents)).toThrowError("There's not enough accents");
    });

    test('no accents at all', () => {
      const word = 'potɨ';
      const accents = '';
      expect(add_tones_to_word(word, accents)).toEqual('potɨ');
    });
  });

  describe('integrate_tones_to_bum_phonetics', () => {
    const created_contents = fs.readFileSync('./spreadsheet_helpers/test_result.txt', 'utf8');
    const expected_contents = `àbâ\nàbâh\nábâm\nàbâŋ\nabehi\nàbɛ̂n\nàbə̂h\nàbə̂h\nàbî\nábìn\nàbɔ̂ŋ\nabɔŋ\nábúk`;
    test('File written successfully', () => {
      integrate_tones_to_bum_phonetics(
        test_words,
        test_tones,
        './spreadsheet_helpers/test_result.txt'
      );
      expect(created_contents).toEqual(expected_contents);
    });

    test("Tones and phonetics don't match", () => {
      expect(() =>
        integrate_tones_to_bum_phonetics(
          test_words,
          test_tones.slice(0, test_tones.length - 1),
          './spreadsheet_helpers/test_result.txt'
        )
      ).toThrowError('Tones and phonetics have to correspond to each other');
    });
  });
}

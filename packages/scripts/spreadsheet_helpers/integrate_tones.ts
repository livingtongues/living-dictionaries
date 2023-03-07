import * as fs from 'fs';
import { test_words } from './test_words';
import { test_tones } from './test_tones';
//TODO previously change L H characters for unicode accents
// \u030C = ˇ (hacek)
// \u0300 = ` (Grave accent)
// \u0301 = ´ (Acute accent)
// \u0302 = ˆ (Circumflex accent)

const phonetics = 'aber';
const accents = '\u030C \u0302';

const bum_vowels = new Set(['a', 'e', 'i', 'o', 'u', 'ɛ', 'ə', 'ɔ', 'ɨ']);

function add_tones(word: string, accents: string) {
  let new_word = '';
  let accent_index = 0;
  if (accents === '') {
    return word;
  }
  const splitted_accents = accents.split(' ');
  const splitted_word = word.split('');
  //TODO console errors instead of throwing them to continue script
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

function integrate_tones_to_bum_phonetics(phonetics: string[], tones: string[]) {
  const new_phonetics: string[] = [];
  if (phonetics.length === tones.length) {
    phonetics.forEach((word, i) => {
      new_phonetics.push(add_tones(word, tones[i]));
    });
  } else {
    throw new Error(`Tones and phonetics have to correspond to each other`);
  }
  console.log(new_phonetics);
}

integrate_tones_to_bum_phonetics(test_words, test_tones);

if (import.meta.vitest) {
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
    expect(add_tones(word, accents)).toEqual(expected);
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
    expect(add_tones(word, accents)).toEqual(expected);
  });

  test('more accents than vowels', () => {
    const word = 'təst';
    const accents = '\u0302 \u0301';
    expect(() => add_tones(word, accents)).toThrowError("There's more accents than vowels");
  });

  test('more vowels than accents', () => {
    const word = 'potɨ';
    const accents = '\u0300';
    expect(() => add_tones(word, accents)).toThrowError("There's not enough accents");
  });

  test('no accents', () => {
    const word = 'potɨ';
    const accents = '';
    expect(add_tones(word, accents)).toEqual('potɨ');
  });
}

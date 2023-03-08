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

export function count_vowels(word: string, vowels: Set<string>): number {
  let number_of_vowels = 0;
  word.split('').forEach((letter) => {
    if (vowels.has(letter)) {
      number_of_vowels += 1;
    }
  });
  return number_of_vowels;
}

export function add_tones_to_word(word: string, accents: string): string {
  if (accents === '') {
    return word;
  }
  let new_word = '';
  let accent_index = 0;
  const splitted_accents = accents.split(' ');
  const splitted_word = word.split('');
  const number_of_vowels_in_word = count_vowels(word, bum_vowels);

  splitted_word.forEach((letter, letter_index) => {
    let new_letter;
    // Adds the tone to every vowel if the number of vowels in the word equals the total number of accents, if not only if the vowel has not another vowel before it: which means it's a diphthong
    if (
      (bum_vowels.has(letter) && number_of_vowels_in_word === splitted_accents.length) ||
      (bum_vowels.has(letter) && !bum_vowels.has(splitted_word[letter_index - 1]))
    ) {
      new_letter = `${letter}${splitted_accents[accent_index]}`;
      accent_index += 1;
    } else {
      new_letter = letter;
    }

    new_word += new_letter;
  });
  if (accent_index != splitted_accents.length) {
    console.warn(`Vowels and accents don't match in: ${word}`);
    return word + ' (please check it!)';
  }
  return new_word;
}

export function integrate_tones_to_bum_phonetics(
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

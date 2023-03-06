//TODO previously change L H characters for unidode accents
// \u030C = ˇ (hacek)
// \u0300 = ` (Grave accent)
// \u0301 = ´ (Acute accent)
// \u0302 = ˆ (Circumflex accent)

const phonetics = 'abero';
const accents = '\u030C \u0302 \u0300';

const bum_vowels = new Set(['a', 'e', 'i', 'o', 'u', 'ɛ', 'ə', 'ɔ', 'ɨ']);

function add_tones(word: string, accents: string) {
  let new_word = '';
  let accent_index = 0;
  const splitted_accents = accents.split(' ');
  const splitted_word = word.split('');
  //TODO compares someway number of vowels is equals to number of accents
  splitted_word.forEach((letter, letter_index) => {
    let new_letter;
    if (bum_vowels.has(letter) && !bum_vowels.has(splitted_word[letter_index - 1])) {
      new_letter = `${letter}${splitted_accents[accent_index]}`;
      accent_index += 1;
    } else {
      new_letter = letter;
    }
    new_word += new_letter;
  });
  return new_word;
}

console.log(add_tones(phonetics, accents));

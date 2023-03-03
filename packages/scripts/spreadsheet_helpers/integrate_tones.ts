//TODO previously change L H characters for unidode accents
// \u030C = ˇ (hacek)
// \u0300 = ` (Grave accent)
// \u0301 = ´ (Acute accent)
// \u0302 = ˆ (Circumflex accent)

const phonetics = 'abera';
const accents = '\u030C \u0302 \u0300';

//TODO for dipthongs I think it will be easier to locate all possible of them in the language (in the spreadsheet)
const kharia_vowels = new Set(['a', 'e', 'i', 'o', 'u', 'ɛ', 'ə', 'ɔ', 'ɨ']);

function add_tones(word: string, accents: string) {
  let accent_index = 0;
  const splitted_accents = accents.split(' ');
  const spelling_word = word.split('');
  //TODO compares someway number of vowels is equals to number of accents
  spelling_word.forEach((letter, letter_index) => {
    if (kharia_vowels.has(letter)) {
      spelling_word[letter_index] = `${letter}${splitted_accents[accent_index]}`;
      accent_index += 1;
    }
  });
  return spelling_word;
}

console.log(add_tones(phonetics, accents));

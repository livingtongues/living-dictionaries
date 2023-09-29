import { readFileSync } from 'fs';
import { test_words } from './fixtures/words';
import { test_tones } from './fixtures/tones';
import {
  count_vowels,
  add_tones_to_word,
  integrate_tones_to_bum_phonetics,
} from './integrate_tones';
import path from 'node:path'

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

  test('add tones when number of vowels and tones are the same, even when the word has two vowels toghether: false diphthongs', () => {
    const word = 'liɛnda';
    const accents = '\u0301 \u0300 \u0300';
    expect(add_tones_to_word(word, accents)).toEqual('líɛ̀ndà');
  });

  test('more accents than vowels', () => {
    const word = 'təst';
    const accents = '\u0302 \u0301';
    expect(add_tones_to_word(word, accents)).toEqual('təst (please check it!)');
  });

  test('more vowels than accents', () => {
    const word = 'potɨ';
    const accents = '\u0300';
    expect(add_tones_to_word(word, accents)).toEqual('potɨ (please check it!)');
  });

  test('no accents at all', () => {
    const word = 'pluma';
    const accents = '';
    expect(add_tones_to_word(word, accents)).toEqual('pluma');
  });
});

describe('integrate_tones_to_bum_phonetics', () => {
  const fixturesFilePath = path.join(__dirname, './fixtures/result.txt')

  const created_contents = readFileSync(fixturesFilePath, 'utf8');
  const expected_contents = `àbâ\nàbâh\nábâm\nàbâŋ\nabehi\nàbɛ̂n\nàbə̂h\nàbə̂h\nàbî\nábìn\nàbɔ̂ŋ\nabɔŋ\nábúk`;

  test('file written successfully', () => {
    integrate_tones_to_bum_phonetics(
      test_words,
      test_tones,
      fixturesFilePath
    );
    expect(created_contents).toEqual(expected_contents);
  });

  test('tones and phonetics don\'t match', () => {
    expect(() =>
      integrate_tones_to_bum_phonetics(
        test_words,
        test_tones.slice(0, test_tones.length - 1),
        fixturesFilePath
      )
    ).toThrow('Tones and phonetics have to correspond to each other');
  });
});

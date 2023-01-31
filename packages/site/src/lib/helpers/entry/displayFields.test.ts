import type { IEntry } from '@living-dictionaries/types';
import {
  getLocalOrthographies,
  showPartsOfSpeech,
  removeItalicTagsWithAPeriod,
} from './displayFields';

describe('getLocalOrthographies', () => {
  test('returns array of local orthographies', () => {
    const entryWith5LocalOrthographies: IEntry =
    {
      lx: 'Hello',
      gl: null,
      lo: 'Nnọọ',
      lo2: 'Привет',
      lo3: 'سلام',
      lo4: 'नमस्ते',
      lo5: 'שלום',
    }
    expect(getLocalOrthographies(entryWith5LocalOrthographies)).toEqual([
      "Nnọọ",
      "Привет",
      "سلام",
      "नमस्ते",
      "שלום",
    ]);
  });
  test('does not return field if field is empty or missing', () => {
    const entryWith3LocalOrthographies: IEntry =
    {
      lx: 'Bye',
      gl: null,
      lo: 'さよなら',
      lo2: '안녕',
      lo3: '',
      lo4: null,
    }
    expect(getLocalOrthographies(entryWith3LocalOrthographies)).toEqual([
      "さよなら",
      "안녕",
    ]);
  });
});

describe('showPartsOfSpeech', () => {
  test('handles a string', () => {
    expect(showPartsOfSpeech('n')).toMatchInlineSnapshot('"n."');
  });
  test('handles empty string', () => {
    expect(showPartsOfSpeech('')).toMatchInlineSnapshot('""');
  });
  test('places a period after item in an array', () => {
    expect(showPartsOfSpeech(['v'])).toMatchInlineSnapshot('"v."');
  });
  test.fails('places a period after each item in an array', () => {
    expect(showPartsOfSpeech(['n', 'adj', 'v'])).toMatchInlineSnapshot('"n., adj., v."');
  });
  test('handles empty array', () => {
    expect(showPartsOfSpeech([])).toMatchInlineSnapshot('""');
  });
  test('handles null', () => {
    expect(showPartsOfSpeech(null)).toMatchInlineSnapshot('""');
  });
});

describe('removeItalicTagsWithAPeriod', () => {
  const sampleStr = 'This <i>is</i> just an <i>example</i> string';
  test('Remove italic HTML tags from strings', () => {
    expect(removeItalicTagsWithAPeriod(sampleStr)).toMatchInlineSnapshot(
      '"This is just an example string."'
    );
  });
});


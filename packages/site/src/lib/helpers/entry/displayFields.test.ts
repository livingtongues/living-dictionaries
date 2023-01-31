import type { IEntry } from '@living-dictionaries/types';
import {
  showLocalOrthographies,
  showPartsOfSpeech,
  removeItalicTagsWithAPeriod,
  unnecessaryLineBreaksRegex,
} from './displayFields';
import { entriesWithAlternateOrthographies } from '../../../routes/[dictionaryId]/entries/print/mock-data';

describe('showLocalOrthographies', () => {
  const mockEntries: IEntry[] = entriesWithAlternateOrthographies;

  test('shows some local orthographies', () => {
    expect(showLocalOrthographies(mockEntries[1]).join(', ')).toMatchInlineSnapshot(
      '"さよなら, 안녕, αντίο"'
    );
  });
  test('shows all local orthographies', () => {
    expect(showLocalOrthographies(mockEntries[0]).join(', ')).toMatchInlineSnapshot(
      '"Nnọọ, Привет, سلام, नमस्ते, שלום"'
    );
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


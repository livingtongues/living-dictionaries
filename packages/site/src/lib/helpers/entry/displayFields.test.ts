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
  const partsOfSpeech = {
    stringPOS: 'n',
    arrayPOS1: ['n', 'adj'],
    arrayPOS2: ['v'],
    emptyArray: [],
    emptyString: '',
    null: null,
  };

  test('Shows parts of speech', () => {
    expect(showPartsOfSpeech(partsOfSpeech.stringPOS)).toMatchInlineSnapshot('"n."');
    expect(showPartsOfSpeech(partsOfSpeech.emptyString)).toMatchInlineSnapshot('""');
    expect(showPartsOfSpeech(partsOfSpeech.arrayPOS1)).toMatchInlineSnapshot('"n, adj."');
    expect(showPartsOfSpeech(partsOfSpeech.arrayPOS2)).toMatchInlineSnapshot('"v."');
    expect(showPartsOfSpeech(partsOfSpeech.emptyArray)).toMatchInlineSnapshot('""');
    expect(showPartsOfSpeech(partsOfSpeech.null)).toMatchInlineSnapshot('""');
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

describe('unnecessaryLineBreaksRegex', () => {
  const phrase = 'This is \nand \nexample \nphrase.';
  test('Replace unnecessary line breaks in a phrase', () => {
    expect(phrase.replace(unnecessaryLineBreaksRegex, '')).toMatchInlineSnapshot(
      '"This is and example phrase."'
    );
  });
});

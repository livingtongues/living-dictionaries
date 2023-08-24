import { ActualDatabaseEntry, AlgoliaEntry } from '@living-dictionaries/types';
import { get_speaker_display_name, prepareDataForIndex, remove_empty_fields } from './prepareDataForIndex';

const dictId = 'foo-dictionary';
const base_algolia_entry: AlgoliaEntry = {
  dictId,
  hasImage: false,
  hasAudio: false,
  hasVideo: false,
  hasSpeaker: false,
  hasSemanticDomain: false,
  hasPartOfSpeech: false,
  hasNounClass: false,
  hasPluralForm: false,
};

describe('prepareDataForIndex', () => {
  test('sets all "has___" fields to false by default', async () => {
    const db_entry: ActualDatabaseEntry = {};
    expect(await prepareDataForIndex(db_entry, dictId, null)).toEqual(base_algolia_entry);
  });

  test('items not needing transformed just pass through', async () => {
    const db_entry: ActualDatabaseEntry = {
      mr: 'morphology',
      ph: 'phonetic',
      scn: ['foo', 'bar'],
    };
    const algolia_entry: AlgoliaEntry = {
      ...base_algolia_entry,
      mr: 'morphology',
      ph: 'phonetic',
      scn: ['foo', 'bar'],
    };
    expect(await prepareDataForIndex(db_entry, dictId, null)).toEqual(algolia_entry);
  });

  test('handles all items from old shape', async () => {
    const db_entry: ActualDatabaseEntry = {
      pf: { gcs: 'foo' },
      createdAt: { _seconds: 2 } as any,
      updatedAt: { _seconds: 1 } as any,
    };
    const algolia_entry: AlgoliaEntry = {
      ...base_algolia_entry,
      pf: { gcs: 'foo' },
      hasImage: true,
      ca: 2,
      ua: 1,
    };
    expect(await prepareDataForIndex(db_entry, dictId, null)).toEqual(algolia_entry);
  });

  test('handles all items from new shape but does not overwrite items not yet moved into sense', async () => {
    const db_entry: ActualDatabaseEntry = {
      sn: [{
        gl: {
          en: 'apple',
        },
        ps: ['n'],
        sd: ['fruit'],
        sdn: ['1.1'],
        xs: [{ en: 'hello everyone' }],
        pfs: [{ gcs: 'foo' }],
        vfs: [{ path: 'filepath' }],
        de: 'a fruit',
      }],
      sfs: [{ path: 'filepath' }],
      nc: 'noun class not yet moved into senses',
      ca: { _seconds: 2 } as any,
      ua: { _seconds: 1 } as any,
    };
    const algolia_entry: AlgoliaEntry = {
      ...base_algolia_entry,
      ...db_entry,
      gl: {
        en: 'apple',
      },
      ps: ['n'],
      hasPartOfSpeech: true,
      sd: ['fruit'],
      sdn: ['1.1'],
      hasSemanticDomain: true,
      pf: { gcs: 'foo' },
      hasImage: true,
      vfs: [{ path: 'filepath' }],
      hasVideo: true,
      de: 'a fruit',
      xs: { en: 'hello everyone' },
      sfs: [{ path: 'filepath' }],
      sf: { path: 'filepath' },
      hasAudio: true,
      nc: 'noun class not yet moved into senses',
      hasNounClass: true,
      ca: 2,
      ua: 1,
    };
    expect(await prepareDataForIndex(db_entry, dictId, null)).toEqual(algolia_entry);
  });

  test('handles speakerName', async () => {
    const db_entry: ActualDatabaseEntry = {
      sf: { path: 'filepath', speakerName: 'Bob' },
    };
    const algolia_entry: AlgoliaEntry = {
      ...base_algolia_entry,
      sf: { path: 'filepath', speakerName: 'Bob' },
      hasAudio: true,
      hasSpeaker: true,
    };
    expect(await prepareDataForIndex(db_entry, dictId, null)).toEqual(algolia_entry);
  });

  test('removes empty fields', async () => {
    const db_entry: ActualDatabaseEntry = {
      mr: '',
      ph: null,
    };
    const algolia_entry: AlgoliaEntry = {
      ...base_algolia_entry,
    };
    expect(await prepareDataForIndex(db_entry, dictId, null)).toEqual(algolia_entry);
  });

  test('does not signal hasPartOfSpeech if empty array', async () => {
    const db_entry: ActualDatabaseEntry = {
      ps: []
    };
    const algolia_entry: AlgoliaEntry = {
      ...base_algolia_entry,
    };
    expect(await prepareDataForIndex(db_entry, dictId, null)).toEqual(algolia_entry);
  });

  test('does not overwrite ub with stale updatedBy', async () => {
    const db_entry: ActualDatabaseEntry = {
      ub: 'accurate',
      updatedBy: 'stale',
    };
    const algolia_entry: AlgoliaEntry = {
      ...base_algolia_entry,
      ub: 'accurate',
    };
    expect(await prepareDataForIndex(db_entry, dictId, null)).toEqual(algolia_entry);
  });
});

describe('get_speaker_display_name', () => {
  const speaker_name = 'John Doe';
  const mockDb = {
    doc: () => {
      return {
        get: () => {
          return new Promise((resolve) => {
            const speakerSnap = {
              id: 'foo',
              data: () => {
                return {
                  displayName: speaker_name,
                };
              },
            };
            resolve(speakerSnap);
          });
        },
      };
    },
  } as any;

  test('returns speaker name', async () => {
    expect(await get_speaker_display_name('foo', mockDb)).toEqual(speaker_name);
  });

  test('returns speaker name in prepareDataForIndex', async () => {
    const db_entry: ActualDatabaseEntry = {
      sfs: [
        { path: 'filepath', sp: ['foo'] },
      ]
    };
    const algolia_entry: AlgoliaEntry = {
      ...base_algolia_entry,
      hasAudio: true,
      hasSpeaker: true,
      sfs: [
        {
          path: 'filepath',
          sp: ['foo'],
          speakerName: speaker_name
        },
      ],
      sf: {
        path: 'filepath',
        // @ts-ignore
        sp: ['foo'],
        speakerName: speaker_name
      },
    };
    expect(await prepareDataForIndex(db_entry, dictId, mockDb)).toEqual(algolia_entry);
  });
});

describe('remove_empty_fields', () => {
  test('empty string', () => {
    const entry = { name: '', age: 20 };
    const result = remove_empty_fields(entry);
    expect(result).toEqual({ age: 20 });
  });

  test('empty array', () => {
    const entry = { name: 'John', hobbies: [] };
    const result = remove_empty_fields(entry);
    expect(result).toEqual({ name: 'John' });
  });

  test('null', () => {
    const entry = { name: 'John', age: null };
    const result = remove_empty_fields(entry);
    expect(result).toEqual({ name: 'John' });
  });

  test('undefined', () => {
    const entry = { name: 'John', address: undefined };
    const result = remove_empty_fields(entry);
    expect(result).toEqual({ name: 'John' });
  });
});

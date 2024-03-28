import type { ActualDatabaseEntry, GoalDatabaseEntry } from '@living-dictionaries/types';
import type { ActualDatabaseAudio } from '@living-dictionaries/types/audio.interface';
import type { ActualDatabasePhoto } from '@living-dictionaries/types/photo.interface';
import type { ActualDatabaseVideo } from '@living-dictionaries/types/video.interface';
import type { Timestamp } from 'firebase/firestore';
import { convert_entry_to_current_shape } from './convert_entry_to_current_shape';

describe(convert_entry_to_current_shape, () => {
  test('converts parts of speech string to string[]', () => {
    const actual_database_entry: ActualDatabaseEntry = { ps: 'n' };
    const goal_database_entry: GoalDatabaseEntry = { sn: [{ ps: ['n'] }] };
    expect(convert_entry_to_current_shape(actual_database_entry)).toEqual(goal_database_entry);
  });

  test('ensure dialects is an array', () => {
    const dialect = 'west';
    const expected: GoalDatabaseEntry = { di: [dialect] }

    const dialect_string = dialect;
    expect(convert_entry_to_current_shape({ di: dialect_string })).toEqual(expected);

    const dialect_array = [dialect];
    expect(convert_entry_to_current_shape({ di: dialect_array })).toEqual(expected);
  });

  test('ensure scientific_names is an array', () => {
    const scientific_name = 'west';
    const expected: GoalDatabaseEntry = { scn: [scientific_name] }

    const scientific_name_string = scientific_name;
    expect(convert_entry_to_current_shape({ scn: scientific_name_string })).toEqual(expected);

    const scientifi_name_array = [scientific_name];
    expect(convert_entry_to_current_shape({ scn: scientifi_name_array })).toEqual(expected);
  });

  test('moves parts of speech arrays', () => {
    const ps = ['n', 'v'];
    const expected: GoalDatabaseEntry = { sn: [{ ps }] }
    expect(convert_entry_to_current_shape({ ps })).toEqual(expected);
  });

  test('converts lo to lo1 if lo1 does not exist', () => {
    const lo = 'foo';
    const expected: GoalDatabaseEntry = { lo1: lo }
    expect(convert_entry_to_current_shape({ lo })).toEqual(expected);
  });

  test('ignores lo if lo1 exists', () => {
    const lo = 'foo';
    const lo1 = 'bar';
    const expected: GoalDatabaseEntry = { lo1 }
    expect(convert_entry_to_current_shape({ lo, lo1 })).toEqual(expected);
  });

  test('converts source string to array of strings', () => {
    const sr = 'I am a string, like found in Kalanga';
    const expected: GoalDatabaseEntry = { sr: [sr] }
    expect(convert_entry_to_current_shape({ sr })).toEqual(expected);
  });

  test('moves sense related fields into first sense (and converts necessary fields)', () => {
    const entry: ActualDatabaseEntry = {
      gl: { en: 'foo' },
      ps: 'n',
      sd: ['bar'],
      sdn: ['1.1'],
      xs: { en: 'baz' },
      xv: 'foo',
      nc: '1',
      de: 'bam'
    }
    const expected: GoalDatabaseEntry = {
      sn: [{
        gl: { en: 'foo' },
        ps: ['n'],
        sd: ['bar'],
        sdn: ['1.1'],
        xs: [{ en: 'baz', vn: 'foo' }],
        nc: '1',
        de: 'bam',
      }]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });

  test('can add xv into first xs item if does not exist', () => {
    const entry: ActualDatabaseEntry = {
      xv: 'foo',
    }
    const expected: GoalDatabaseEntry = {
      sn: [{
        xs: [{ vn: 'foo' }],
      }]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });

  test('if entry has old xv and new example sentence that is not vernacular', () => {
    const entry: ActualDatabaseEntry = {
      xv: 'vernacular',
      xs: { en: 'english' },
    }
    const expected: GoalDatabaseEntry = {
      sn: [{
        xs: [{ en: 'english', vn: 'vernacular' }],
      }]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });

  test('if entry has both xv and xs.vn then xs.vn is used', () => {
    const entry: ActualDatabaseEntry = {
      xv: 'should not show',
      xs: { vn: 'should show' },
    }
    const expected: GoalDatabaseEntry = {
      sn: [{
        xs: [{ vn: 'should show' }],
      }]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });

  test('sound file is placed into array', () => {
    const sf: ActualDatabaseAudio = {
      path: 'foo',
      sp: 'x123',
    }
    const entry: ActualDatabaseEntry = { sf }
    const expected: GoalDatabaseEntry = {
      sfs: [{
        path: 'foo',
        sp: ['x123'],
      }],
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });

  test('when both sf and sfs[0] exist, sf does not overwrite', () => {
    const doubledUp: ActualDatabaseEntry = {
      sf: { path: 'foo', sp: 'x123' },
      sfs: [{ path: 'bar', sp: ['x456'] }],
    }
    const expected: GoalDatabaseEntry = {
      sfs: [{ path: 'bar', sp: ['x456'] }],
    }
    expect(convert_entry_to_current_shape(doubledUp)).toEqual(expected);
  });

  test('photo file is placed into array in first sense', () => {
    const pf: ActualDatabasePhoto = {
      path: 'foo',
      uploadedBy: 'x456',
    }
    const entry: ActualDatabaseEntry = { pf }
    const expected: GoalDatabaseEntry = {
      sn: [
        {
          pfs: [{
            path: 'foo',
            ab: 'x456',
          }],
        }
      ]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });

  test('video file array is placed into first sense', () => {
    const vfs: ActualDatabaseVideo[] = [{
      path: 'foo',
      sp: 'x123',
    }]
    const entry: ActualDatabaseEntry = { vfs }
    const expected: GoalDatabaseEntry = {
      sn: [
        {
          vfs: [{
            path: 'foo',
            sp: ['x123'],
          }],
        }
      ]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });

  test('deprecated metadata fields are renamed, preferring createdBy over ab', () => {
    const entry: ActualDatabaseEntry = {
      ab: 'adder',
      createdBy: 'creator',
      updatedBy: 'updater',
      createdAt: 1 as unknown as Timestamp,
      updatedAt: 2 as unknown as Timestamp,
    }
    const expected: GoalDatabaseEntry = {
      cb: 'creator',
      ub: 'updater',
      ca: 1 as unknown as Timestamp,
      ua: 2 as unknown as Timestamp,
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
    expect(convert_entry_to_current_shape({ ab: 'adder' })).toEqual({ cb: 'adder' });
  })

  test('only has base sense fields and no sense', () => {
    const entry: ActualDatabaseEntry = {
      gl: { en: 'only sense' },
    }
    const expected: GoalDatabaseEntry = {
      sn: [{
        gl: { en: 'only sense' },
      }]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });

  test('no base sense fields and a sense', () => {
    const entry: ActualDatabaseEntry = {
      sn: [{
        gl: { en: 'only sense' },
      }]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(entry);
  });

  // this condition should not exist in database
  test('pulls sense from base does not overwrite existing sense', () => {
    const entry: ActualDatabaseEntry = {
      gl: { en: 'first' },
      sn: [{
        gl: { en: 'second' },
      }]
    }
    const expected: GoalDatabaseEntry = {
      sn: [
        { gl: { en: 'first' } },
        { gl: { en: 'second' } }
      ]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });

  test('handles null fields', () => {
    const entry: ActualDatabaseEntry = {
      sf: null,
      pf: null,
    }
    expect(convert_entry_to_current_shape(entry)).toEqual({});
  });

  test('handles string semantic domains', () => {
    const entry: ActualDatabaseEntry = {
      sd: 'bird'
    }
    const expected: GoalDatabaseEntry = {
      sn: [{
        sd: ['bird']
      }]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected)
  })
});

import type { ActualDatabaseEntry, GoalDatabaseEntry } from "@living-dictionaries/types";
import type { ActualDatabaseAudio } from "@living-dictionaries/types/audio.interface";
import type { ActualDatabasePhoto } from "@living-dictionaries/types/photo.interface";
import type { ActualDatabaseVideo } from "@living-dictionaries/types/video.interface";
import type { Timestamp } from "firebase/firestore";
import { convert_entry_to_current_shape } from "./convert_entry_to_current_shape";

describe('convert_entry_to_current_shape', () => {
  test('converts parts of speech string to string[]', () => {
    const actual_database_entry: ActualDatabaseEntry = { ps: 'n' };
    const goal_database_entry: GoalDatabaseEntry = { sn: [{ ps: ['n'], }] };
    expect(convert_entry_to_current_shape(actual_database_entry)).toEqual(goal_database_entry);
  });

  test('moves parts of speech arrays', () => {
    const ps = ['n', 'v'];
    expect(convert_entry_to_current_shape({ ps })).toEqual({ sn: [{ ps }] });
  });

  test('converts lo to lo1', () => {
    const lo = 'foo';
    expect(convert_entry_to_current_shape({ lo })).toEqual({ lo1: lo });
  });

  test('moves sense related fields into first sense', () => {
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

  test('can add xv into first xs item even if it does not exist yet', () => {
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
        { gl: { en: 'first' }, },
        { gl: { en: 'second' }, }
      ]
    }
    expect(convert_entry_to_current_shape(entry)).toEqual(expected);
  });
});

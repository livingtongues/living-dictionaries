import type { ActualDatabaseAudio, GoalDatabaseAudio } from '@living-dictionaries/types/audio.interface';

export function convert_sound_file_to_current_shape(actual: ActualDatabaseAudio): GoalDatabaseAudio {
  if (!actual) return null;

  const goal: GoalDatabaseAudio = { path: actual.path, speakerName: actual.speakerName };

  goal.ab = actual.ab || actual.uploadedBy;
  goal.ts = actual.ts || actual.uploadedAt;
  if (typeof actual.sp === 'string')
    goal.sp = [actual.sp];
  else
    goal.sp = actual.sp;

  goal.sc = actual.sc || actual.source;

  return goal;
}

if (import.meta.vitest) {
  describe('convert_sound_file_to_current_shape', () => {
    const uploadedAt = new Date().getTime();
    test('converts deprecated fields to current ones', () => {
      const actual: ActualDatabaseAudio = {
        path: 'some path',
        sp: 'x123',
        uploadedBy: 'x456',
        uploadedAt,
        source: 'some source',
      };
      const goal: GoalDatabaseAudio = {
        path: 'some path',
        sp: ['x123'],
        ab: 'x456',
        ts: uploadedAt,
        sc: 'some source',
      };
      expect(convert_sound_file_to_current_shape(actual)).toEqual(goal);
    });

    test('does not overwrite current fields with properties from deprecated', () => {
      const actual: ActualDatabaseAudio = {
        path: 'some path',
        uploadedBy: 'x456',
        ab: 'should stay',
      };
      const goal: GoalDatabaseAudio = {
        path: 'some path',
        ab: 'should stay',
      };
      expect(convert_sound_file_to_current_shape(actual)).toEqual(goal);
    });

    test('handles undefined', () => {
      expect(convert_sound_file_to_current_shape(undefined)).toEqual(null);
    });
  });
}

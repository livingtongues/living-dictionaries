import type { ActualDatabasePhoto, GoalDatabasePhoto } from "@living-dictionaries/types/photo.interface";

export function convert_photo_file_to_current_shape(actual: ActualDatabasePhoto): GoalDatabasePhoto {
  if (!actual) return null;
  
  const goal: GoalDatabasePhoto = { path: actual.path, gcs: actual.gcs, cr: actual.cr };

  goal.ab = actual.ab || actual.uploadedBy;
  goal.ts = actual.ts || actual.uploadedAt;
  goal.sc = actual.sc || actual.source;

  return goal;
}

if (import.meta.vitest) {
  describe('convert_photo_file_to_current_shape', () => {
    const uploadedAt = new Date().getTime();
    test('converts deprecated fields to current ones', () => {
      const actual: ActualDatabasePhoto = {
        path: 'some path',
        gcs: 'url',
        cr: 'Bob',
        uploadedBy: 'x456',
        uploadedAt,
        source: 'some source',
      };
      const goal: GoalDatabasePhoto = {
        path: 'some path',
        gcs: 'url',
        cr: 'Bob',
        ab: 'x456',
        ts: uploadedAt,
        sc: 'some source',
      };
      expect(convert_photo_file_to_current_shape(actual)).toEqual(goal);
    });

    test('does not overwrite current fields with properties from deprecated', () => {
      const actual: ActualDatabasePhoto = {
        path: 'some path',
        uploadedBy: 'x456',
        ab: 'should stay',
      };
      const goal: GoalDatabasePhoto = {
        path: 'some path',
        ab: 'should stay',
      };
      expect(convert_photo_file_to_current_shape(actual)).toEqual(goal);
    });
  });
}

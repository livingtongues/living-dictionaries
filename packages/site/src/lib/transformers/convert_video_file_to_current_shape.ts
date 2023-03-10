import type { ActualDatabaseVideo, GoalDatabaseVideo } from "@living-dictionaries/types/video.interface";

export function convert_video_file_to_current_shape(actual: ActualDatabaseVideo): GoalDatabaseVideo {
  // @ts-ignore
  const goal: GoalDatabaseVideo = { ...actual };
  if (typeof actual.sp === 'string') {
    goal.sp = [actual.sp];
  }
  return goal;
}

if (import.meta.vitest) {
  describe('convert_video_file_to_current_shape', () => {
    test('converts speakerId string into array', () => {
      const actual: ActualDatabaseVideo = {
        path: 'some path',
        sp: 'x123',
      };
      const goal: GoalDatabaseVideo = {
        path: 'some path',
        sp: ['x123'],
      };
      expect(convert_video_file_to_current_shape(actual)).toEqual(goal);
    });
  });
}

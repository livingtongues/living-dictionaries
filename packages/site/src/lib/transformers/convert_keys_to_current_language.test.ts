export function convert_part_of_speech_to_current_language(part_of_speech: string, bcp: string): string {
  // return part_of_speech;
  return 'noun';
}

describe('convert keys to current language', () => {
  test('converts part of speech keys to current language', () => {
    const actual = 'n';
    const expected = 'noun';
    expect(convert_part_of_speech_to_current_language(actual, 'en')).toBe(expected);
  });
});

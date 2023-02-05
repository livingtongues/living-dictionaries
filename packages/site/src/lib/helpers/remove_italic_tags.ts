export function remove_italic_tags(string: string): string {
  return string?.replace(/<\/?i>/g, '') || '';
}

if (import.meta.vitest) {
  describe('remove_italic_tags', () => {
    const sampleStr = 'This <i>is</i> just an <i>example</i> string';
    test('Removes italic HTML tags from strings', () => {
      expect(remove_italic_tags(sampleStr)).toMatchInlineSnapshot(
        '"This is just an example string"'
      );
    });
  });
}
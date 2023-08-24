import type { IExampleSentence } from '@living-dictionaries/types';

export function spaceSeparateSentences(sentences: IExampleSentence[]): string {
  if (!sentences) return '';
  return sentences.map((sentence) => Object.values(sentence).join(' ')).join(' ');
}

if (import.meta.vitest) {
  describe(spaceSeparateSentences, () => {
    it('should return an empty string when given an empty array', () => {
      expect(spaceSeparateSentences([])).toBe('');
      expect(spaceSeparateSentences(null)).toBe('');
    });

    it('should return a string with sentences separated by spaces', () => {
      const sentences: IExampleSentence[] = [
        {
          en: 'This is the first sentence.',
          vn: 'Đây là câu đầu tiên.'
        },
        {
          en: 'This is the second sentence.',
          vn: 'Đây là câu thứ hai.'
        },
      ];
      expect(spaceSeparateSentences(sentences)).toBe(
        'This is the first sentence. Đây là câu đầu tiên. This is the second sentence. Đây là câu thứ hai.'
      );
    });
  });
}

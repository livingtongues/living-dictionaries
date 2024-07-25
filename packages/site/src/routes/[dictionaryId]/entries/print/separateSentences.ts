import type { IExampleSentence } from '@living-dictionaries/types'

export function slashSeparateSentences(sentences: IExampleSentence[]): string {
  if (!sentences) return ''
  return sentences.map(sentence => Object.values(sortVernacularFirst(sentence)).join(' / ')).join(' ')
}

export function sortVernacularFirst(example_sentence: IExampleSentence) {
  const sortedKeys = Object.keys(example_sentence).sort((keyA, keyB) =>
    keyA.startsWith('vn') ? -1 : keyB.startsWith('vn') ? 1 : 0,
  )

  const sorted_example_sentences = {}
  sortedKeys.forEach((key) => {
    sorted_example_sentences[key] = example_sentence[key]
  })

  return sorted_example_sentences
}

if (import.meta.vitest) {
  describe(slashSeparateSentences, () => {
    it('should return an empty string when given an empty array', () => {
      expect(slashSeparateSentences([])).toBe('')
      expect(slashSeparateSentences(null)).toBe('')
    })

    it('should return a string with sentences separated by spaces', () => {
      const sentences: IExampleSentence[] = [
        {
          en: 'This is the first sentence.',
          vn: 'Prima lexema sententia.',
          es: 'Esta es la primer oración.',
        },
        {
          en: 'This is the second sentence.',
          vn: 'Secunda lexema sententia.',
          es: 'Esta es la segunda oración.',
        },
      ]
      expect(slashSeparateSentences(sentences)).toBe(
        'Prima lexema sententia. / This is the first sentence. / Esta es la primer oración. Secunda lexema sententia. / This is the second sentence. / Esta es la segunda oración.',
      )
    })
  })

  describe(sortVernacularFirst, () => {
    it('should sort keys with vn first', () => {
      const example_sentences = { es: 'Spanish sentence', en: 'English sentence.', vn: 'Vernacular sentence.' }
      expect(sortVernacularFirst(example_sentences)).toEqual(
        {
          vn: 'Vernacular sentence.',
          en: 'English sentence.',
          es: 'Spanish sentence',
        },
      )
    })
  })
}

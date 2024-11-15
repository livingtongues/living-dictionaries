import type { DefaultTokenizer } from '@orama/orama'
import { simplify_lexeme_for_search } from './augment-entry-for-search'

function normalizeToken(this: DefaultTokenizer, prop: string, token: string): string {
  return token
}

// _withCache is true for user searches and false when indexing
export function tokenize(input: string, language?: string, prop = '', _withCache = true): string[] {
  if (typeof input !== 'string') {
    return [input]
  }

  let tokens: string[] = []
  const words = input
    .toLowerCase()
    .split(/[\s.,;:!?()、，。！？（）]+/g)

  if (prop === '_lexeme') {
    const word_portions: string[] = []
    for (const word of words) {
      if (word.length === 1) {
        word_portions.push(word)
      } else {
        for (let i = 0; i < word.length - 1; i++) {
          word_portions.push(word.slice(i))
        }
      }
    }

    tokens = word_portions
      .map(t => [t, simplify_lexeme_for_search(t)])
      .flat()
      .filter(Boolean)
  } else {
    tokens = words
      .filter(Boolean)
  }

  return Array.from(new Set(tokens))
}

export function createMultilingualTokenizer(): DefaultTokenizer {
  return {
    language: 'multi',
    tokenize,
    normalizationCache: new Map(),
    // not used
    normalizeToken,
    tokenizeSkipProperties: new Set([]),
    stemmerSkipProperties: new Set([]),
    allowDuplicates: false,
  }
}

/**
 * Paste-to-sentences segmentation for the texts ingest flow
 * (.issues/texts-sentences-pipeline.md M2). Deliberately naive v1: terminal
 * punctuation ends a sentence (abbreviation handling, `Intl.Segmenter` for
 * no-space scripts, etc. are future refinements) — the ingest UI lets the user
 * correct the segmentation before saving, so the splitter only has to be a
 * good first guess.
 *
 * Rules:
 * - A blank line ends a paragraph → the preceding sentence gets
 *   `ends_paragraph` (matching `sentences.ends_paragraph`: "a paragraph break
 *   FOLLOWS this sentence", so the very last sentence never carries it).
 * - A single newline ends a sentence but not a paragraph (verse-per-line
 *   pastes segment cleanly without punctuation).
 * - Terminal punctuation: `.` `!` `?` `…` + CJK `。` `！` `？` `．`, in runs
 *   (`?!`, `...`), keeping trailing closers (quotes/brackets) with the
 *   sentence.
 */

export interface SplitSentence {
  text: string
  ends_paragraph: boolean
}

const TERMINAL = String.raw`.!?…。！？．`
const CLOSERS = String.raw`"'”’»›)\]｣」』`
const SENTENCE_MATCH = new RegExp(`[^${TERMINAL}]*[${TERMINAL}]+[${CLOSERS}]*\\s*|[^${TERMINAL}]+$`, 'gu')

function split_line(line: string): string[] {
  const chunks = line.match(SENTENCE_MATCH) ?? []
  return chunks.map(chunk => chunk.trim()).filter(Boolean)
}

export function split_text_into_sentences(body: string): SplitSentence[] {
  const sentences: SplitSentence[] = []
  const paragraphs = body.split(/\n\s*\n/)
  for (const paragraph of paragraphs) {
    const paragraph_sentences = paragraph
      .split('\n')
      .flatMap(line => split_line(line))
    if (!paragraph_sentences.length)
      continue
    if (sentences.length)
      sentences[sentences.length - 1].ends_paragraph = true
    sentences.push(...paragraph_sentences.map(text => ({ text, ends_paragraph: false })))
  }
  return sentences
}

if (import.meta.vitest) {
  describe(split_text_into_sentences, () => {
    test('splits on terminal punctuation within a paragraph', () => {
      expect(split_text_into_sentences('One. Two! Three?')).toEqual([
        { text: 'One.', ends_paragraph: false },
        { text: 'Two!', ends_paragraph: false },
        { text: 'Three?', ends_paragraph: false },
      ])
    })

    test('blank line marks a paragraph break on the sentence BEFORE it', () => {
      expect(split_text_into_sentences('First. Second.\n\nThird.')).toEqual([
        { text: 'First.', ends_paragraph: false },
        { text: 'Second.', ends_paragraph: true },
        { text: 'Third.', ends_paragraph: false },
      ])
    })

    test('single newline splits sentences without a paragraph break (verse-per-line)', () => {
      expect(split_text_into_sentences('line one\nline two')).toEqual([
        { text: 'line one', ends_paragraph: false },
        { text: 'line two', ends_paragraph: false },
      ])
    })

    test('keeps punctuation runs and trailing quotes with the sentence', () => {
      expect(split_text_into_sentences('“Really?!” she said... Then quiet.')).toEqual([
        { text: '“Really?!”', ends_paragraph: false },
        { text: 'she said...', ends_paragraph: false },
        { text: 'Then quiet.', ends_paragraph: false },
      ])
    })

    test('handles CJK terminals and ellipsis', () => {
      expect(split_text_into_sentences('你好。再见！等等…')).toEqual([
        { text: '你好。', ends_paragraph: false },
        { text: '再见！', ends_paragraph: false },
        { text: '等等…', ends_paragraph: false },
      ])
    })

    test('a trailing sentence without punctuation is kept', () => {
      expect(split_text_into_sentences('Done. And more')).toEqual([
        { text: 'Done.', ends_paragraph: false },
        { text: 'And more', ends_paragraph: false },
      ])
    })

    test('collapses extra blank lines and whitespace-only lines', () => {
      expect(split_text_into_sentences('A.\n\n\n  \n\nB.')).toEqual([
        { text: 'A.', ends_paragraph: true },
        { text: 'B.', ends_paragraph: false },
      ])
    })

    test('empty and whitespace-only input yields nothing', () => {
      expect(split_text_into_sentences('')).toEqual([])
      expect(split_text_into_sentences('  \n\n \n ')).toEqual([])
    })
  })
}

/**
 * Word-level diff for the "needs review" banner: two printings of one value,
 * with the spans that differ marked on BOTH sides. Deliberately not a
 * red/green add/remove diff — neither version is wrong yet, that's the question
 * the reviewer is answering.
 */

export interface DiffSegment {
  text: string
  changed: boolean
}

export interface ValueDiff {
  a: DiffSegment[]
  b: DiffSegment[]
}

/** Beyond this many tokens per side the O(n·m) table isn't worth it — mark the whole value. */
const MAX_TOKENS = 400
/** A replaced block shorter than this on both sides is a candidate for character refinement. */
const MAX_CHARS_FOR_CHARACTER_REFINEMENT = 60
/**
 * Refining two unrelated words down to characters produces confetti
 * (`obtain` / `get` share only a `t`), so a refinement is kept only when the
 * two sides really are near-variants of each other.
 */
const MIN_CHARACTER_SIMILARITY = 0.5
/** Past this share of changed characters the two versions are simply different wordings. */
const MAX_CHANGED_RATIO = 0.6

export function diff_values({ a, b }: { a: string, b: string }): ValueDiff {
  if (a === b)
    return { a: segments(a), b: segments(b) }

  const a_tokens = tokenize(a)
  const b_tokens = tokenize(b)

  if (a_tokens.length > MAX_TOKENS || b_tokens.length > MAX_TOKENS)
    return { a: segments(a, { changed: true }), b: segments(b, { changed: true }) }

  const blocks = align(a_tokens, b_tokens)
  const a_out: DiffSegment[] = []
  const b_out: DiffSegment[] = []

  for (const block of blocks) {
    const a_text = block.a.join('')
    const b_text = block.b.join('')
    if (block.equal) {
      a_out.push(...segments(a_text))
      b_out.push(...segments(b_text))
      continue
    }
    if (a_text && b_text && a_text.length <= MAX_CHARS_FOR_CHARACTER_REFINEMENT && b_text.length <= MAX_CHARS_FOR_CHARACTER_REFINEMENT) {
      const refined = refine_characters({ a: a_text, b: b_text })
      if (refined) {
        a_out.push(...refined.a)
        b_out.push(...refined.b)
        continue
      }
    }
    a_out.push(...segments(a_text, { changed: true }))
    b_out.push(...segments(b_text, { changed: true }))
  }

  const a_merged = merge(a_out)
  const b_merged = merge(b_out)

  // When the two versions barely overlap, per-word marks are confetti that hides
  // the point instead of making it — the whole wording differs, so say nothing.
  if (changed_ratio(a_merged) > MAX_CHANGED_RATIO || changed_ratio(b_merged) > MAX_CHANGED_RATIO)
    return { a: segments(a), b: segments(b) }

  return { a: a_merged, b: b_merged }
}

function changed_ratio(list: DiffSegment[]): number {
  const total = list.reduce((sum, segment) => sum + segment.text.length, 0)
  if (!total) return 0
  const changed = list.filter(segment => segment.changed).reduce((sum, segment) => sum + segment.text.length, 0)
  return changed / total
}

/** Words and whitespace runs as separate tokens, so a spacing-only change is visible. */
function tokenize(value: string): string[] {
  return value.split(/(\s+)/).filter(Boolean)
}

function segments(text: string, { changed = false }: { changed?: boolean } = {}): DiffSegment[] {
  if (!text) return []
  return [{ text, changed }]
}

function merge(list: DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = []
  for (const segment of list) {
    if (!segment.text) continue
    const previous = merged[merged.length - 1]
    if (previous && previous.changed === segment.changed)
      previous.text += segment.text
    else
      merged.push({ ...segment })
  }
  return merged
}

interface Block {
  equal: boolean
  a: string[]
  b: string[]
}

/** Longest-common-subsequence alignment → alternating equal / changed blocks. */
function align(a: string[], b: string[]): Block[] {
  const rows = a.length
  const columns = b.length
  const table: number[][] = Array.from({ length: rows + 1 }, () => Array.from<number>({ length: columns + 1 }).fill(0))

  for (let i = rows - 1; i >= 0; i--) {
    for (let j = columns - 1; j >= 0; j--)
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  }

  const blocks: Block[] = []
  let i = 0
  let j = 0
  while (i < rows || j < columns) {
    if (i < rows && j < columns && a[i] === b[j]) {
      const equal: string[] = []
      while (i < rows && j < columns && a[i] === b[j]) {
        equal.push(a[i])
        i++
        j++
      }
      blocks.push({ equal: true, a: equal, b: [...equal] })
      continue
    }
    const changed_a: string[] = []
    const changed_b: string[] = []
    while (i < rows || j < columns) {
      if (i < rows && j < columns && a[i] === b[j]) break
      if (j >= columns || (i < rows && table[i + 1][j] >= table[i][j + 1])) {
        changed_a.push(a[i])
        i++
      } else {
        changed_b.push(b[j])
        j++
      }
    }
    blocks.push({ equal: false, a: changed_a, b: changed_b })
  }

  return blocks
}

/**
 * Character-level pass inside a short replaced block (the one-letter respelling
 * case). Returns `null` when the two sides are too dissimilar for it to help.
 */
function refine_characters({ a, b }: { a: string, b: string }): ValueDiff | null {
  const blocks = drop_lone_characters(align([...a], [...b]))
  const common = blocks.filter(block => block.equal).reduce((total, block) => total + block.a.length, 0)
  if ((2 * common) / (a.length + b.length) < MIN_CHARACTER_SIMILARITY) return null

  const a_out: DiffSegment[] = []
  const b_out: DiffSegment[] = []
  for (const block of blocks) {
    a_out.push(...segments(block.a.join(''), { changed: !block.equal }))
    b_out.push(...segments(block.b.join(''), { changed: !block.equal }))
  }
  return { a: a_out, b: b_out }
}

/** A single matching character between two changed runs reads as noise — fold it in. */
function drop_lone_characters(blocks: Block[]): Block[] {
  return blocks.map((block, index) => {
    const is_island = block.equal && block.a.length === 1 && index > 0 && index < blocks.length - 1
    return is_island ? { ...block, equal: false } : block
  })
}

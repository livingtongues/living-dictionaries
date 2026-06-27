/**
 * Block-level diff for the /admin/legal-review before/after view. Legal docs are diffed
 * at the paragraph/heading/bullet level (NOT physical line level) so a re-wrapped paragraph
 * doesn't show as a change — only genuine wording edits do. Changed/added/removed blocks are
 * highlighted yellow in the UI.
 */

export interface DiffRow {
  left: string | null
  right: string | null
  changed: boolean
}

/**
 * Split markdown into comparable blocks: headings, list items, and paragraphs each become
 * one block, with wrapped lines inside a paragraph joined into a single space-separated string.
 */
export function to_blocks(md: string): string[] {
  const blocks: string[] = []
  let buffer: string[] = []
  const flush = () => {
    if (buffer.length) {
      blocks.push(buffer.join(' ').replace(/\s+/g, ' ').trim())
      buffer = []
    }
  }
  const is_structural = (line: string) => /^(?:#{1,6}\s|[-*]\s|\d+\.\s|>\s)/.test(line)

  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    if (is_structural(line)) {
      flush()
      blocks.push(line.replace(/\s+/g, ' '))
      continue
    }
    buffer.push(line)
  }
  flush()
  return blocks
}

/** Longest-common-subsequence of two block arrays (exact-match equality). */
function lcs_ops(a: string[], b: string[]): { tag: 'equal' | 'delete' | 'insert', value: string }[] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from<number>({ length: m + 1 }).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  }
  const ops: { tag: 'equal' | 'delete' | 'insert', value: string }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ tag: 'equal', value: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ tag: 'delete', value: a[i++] })
    } else {
      ops.push({ tag: 'insert', value: b[j++] })
    }
  }
  while (i < n) ops.push({ tag: 'delete', value: a[i++] })
  while (j < m) ops.push({ tag: 'insert', value: b[j++] })
  return ops
}

/** Align two block arrays into side-by-side rows; deletes pair with adjacent inserts as "changed". */
export function diff_blocks(before: string[], after: string[]): DiffRow[] {
  const ops = lcs_ops(before, after)
  const rows: DiffRow[] = []
  let k = 0
  while (k < ops.length) {
    const op = ops[k]
    if (op.tag === 'equal') {
      rows.push({ left: op.value, right: op.value, changed: false })
      k++
      continue
    }
    // Collect a contiguous run of deletes+inserts and pair them row-by-row.
    const dels: string[] = []
    const ins: string[] = []
    while (k < ops.length && ops[k].tag !== 'equal') {
      if (ops[k].tag === 'delete') dels.push(ops[k].value)
      else ins.push(ops[k].value)
      k++
    }
    const pairs = Math.max(dels.length, ins.length)
    for (let p = 0; p < pairs; p++)
      rows.push({ left: dels[p] ?? null, right: ins[p] ?? null, changed: true })
  }
  return rows
}

export function diff_markdown(before_md: string, after_md: string): DiffRow[] {
  return diff_blocks(to_blocks(before_md), to_blocks(after_md))
}

if (import.meta.vitest) {
  describe(to_blocks, () => {
    it('joins wrapped lines into one paragraph block', () => {
      expect(to_blocks('alpha\nbeta\ngamma')).toEqual(['alpha beta gamma'])
    })

    it('splits paragraphs on blank lines and keeps headings/bullets as own blocks', () => {
      expect(to_blocks('# Title\n\npara one\nwrapped\n\n- item a\n- item b')).toEqual([
        '# Title',
        'para one wrapped',
        '- item a',
        '- item b',
      ])
    })
  })

  describe(diff_markdown, () => {
    it('marks identical docs as unchanged', () => {
      const rows = diff_markdown('# A\n\nsame para', '# A\n\nsame para')
      expect(rows.every(row => !row.changed)).toBe(true)
      expect(rows).toHaveLength(2)
    })

    it('pairs a reworded paragraph as a single changed row', () => {
      const rows = diff_markdown('# A\n\nold wording', '# A\n\nnew wording')
      expect(rows[0]).toEqual({ left: '# A', right: '# A', changed: false })
      expect(rows[1]).toEqual({ left: 'old wording', right: 'new wording', changed: true })
    })

    it('represents a pure addition as a right-only changed row', () => {
      const rows = diff_markdown('shared', 'shared\n\nbrand new')
      expect(rows[0]).toEqual({ left: 'shared', right: 'shared', changed: false })
      expect(rows[1]).toEqual({ left: null, right: 'brand new', changed: true })
    })

    it('ignores paragraph re-wrapping', () => {
      const before = 'one two\nthree four'
      const after = 'one two three four'
      expect(diff_markdown(before, after).every(row => !row.changed)).toBe(true)
    })
  })
}

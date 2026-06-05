/**
 * Score how well a search query matches a record made of weighted fields.
 *
 * Multi-token: the query is split on whitespace; **every** token must match
 * somewhere (AND semantics). Final score = sum of each token's best per-field
 * score. If any token has no match, the record is rejected (returns 0).
 *
 * Per-token / per-field scoring tiers (before field weight is applied):
 *   1000 — exact match of full field value
 *    800 — exact match of a word inside the field
 *    500 — field starts with token
 *    400 — a word inside the field starts with token
 *    200 — field contains token (substring)
 *  30-180 — subsequence match (chars in order; tighter spans score higher)
 *  30-40 — typo (Damerau-Levenshtein 1 or 2 from a word; only tokens >= 3 chars)
 *     0 — no match
 */

export interface ScoreField {
  value: string
  weight?: number
}

export function score_record(query: string, fields: ScoreField[]): number {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0)
    return 0
  let total = 0
  for (const token of tokens) {
    let best = 0
    for (const { value, weight = 1 } of fields) {
      if (!value)
        continue
      const score = score_token(token, value.toLowerCase()) * weight
      if (score > best)
        best = score
    }
    if (best === 0)
      return 0
    total += best
  }
  return total
}

function score_token(token: string, value: string): number {
  if (!token || !value)
    return 0
  if (value === token)
    return 1000
  const words = split_words(value)
  if (words.includes(token))
    return 800
  if (value.startsWith(token))
    return 500
  if (words.some(word => word.startsWith(token)))
    return 400
  if (value.includes(token))
    return 200
  const subseq = subsequence_score(token, value)
  if (subseq > 0)
    return subseq
  if (token.length < 3)
    return 0
  let best_typo = 0
  for (const word of words) {
    if (word.length < 3)
      continue
    if (Math.abs(word.length - token.length) > 2)
      continue
    const distance = damerau_levenshtein(token, word, 2)
    if (distance === 0 || distance > 2)
      continue
    const score = distance === 1 ? 40 : 30
    if (score > best_typo)
      best_typo = score
  }
  return best_typo
}

function split_words(value: string): string[] {
  return value.split(/[\s._@\-+/]+/).filter(Boolean)
}

function subsequence_score(needle: string, haystack: string): number {
  let needle_index = 0
  let last_match = -1
  let total_gap = 0
  let consec = 1
  let max_consec = 1
  let first_match = -1
  for (let i = 0; i < haystack.length && needle_index < needle.length; i++) {
    if (haystack[i] !== needle[needle_index])
      continue
    if (first_match < 0)
      first_match = i
    if (last_match >= 0) {
      const gap = i - last_match - 1
      if (gap === 0) {
        consec++
      } else {
        if (consec > max_consec)
          max_consec = consec
        consec = 1
        total_gap += gap
      }
    }
    last_match = i
    needle_index++
  }
  if (needle_index < needle.length)
    return 0
  if (consec > max_consec)
    max_consec = consec
  let score = 50 + max_consec * 5 - Math.min(40, total_gap)
  if (first_match === 0)
    score += 10
  if (score < 30)
    score = 30
  if (score > 180)
    score = 180
  return score
}

/**
 * Damerau-Levenshtein edit distance with early termination.
 * Returns `max + 1` if the distance exceeds `max`. Supports adjacent
 * transpositions (so 'jcaob' vs 'jacob' costs 1, not 2).
 */
function damerau_levenshtein(left: string, right: string, max: number): number {
  const left_len = left.length
  const right_len = right.length
  if (left_len === 0) return right_len
  if (right_len === 0) return left_len
  if (Math.abs(left_len - right_len) > max) return max + 1

  let prev2: number[] = Array.from({ length: right_len + 1 }, () => 0)
  let prev1: number[] = Array.from({ length: right_len + 1 }, (_, j) => j)
  let curr: number[] = Array.from({ length: right_len + 1 }, () => 0)

  for (let i = 1; i <= left_len; i++) {
    curr[0] = i
    let [row_min] = curr
    for (let j = 1; j <= right_len; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev1[j] + 1,
        curr[j - 1] + 1,
        prev1[j - 1] + cost,
      )
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1])
        curr[j] = Math.min(curr[j], prev2[j - 2] + 1)
      if (curr[j] < row_min)
        row_min = curr[j]
    }
    if (row_min > max)
      return max + 1
    const tmp = prev2
    prev2 = prev1
    prev1 = curr
    curr = tmp
  }
  return prev1[right_len]
}

if (import.meta.vitest) {
  const fields_of = (name: string, email: string, aliases: string[] = [], stripe_id = '') => [
    { value: name, weight: 1 },
    { value: email, weight: 1 },
    ...aliases.map(alias => ({ value: alias, weight: 0.8 })),
    { value: stripe_id, weight: 0.5 },
  ]

  describe(score_record, () => {
    it('returns 0 for empty query', () => {
      expect(score_record('', fields_of('Jacob', 'jacob@example.com'))).toBe(0)
      expect(score_record('   ', fields_of('Jacob', 'jacob@example.com'))).toBe(0)
    })

    it('exact match scores highest', () => {
      const exact = score_record('jacob', fields_of('jacob', 'other@x.com'))
      const word = score_record('jacob', fields_of('Jacob Runner', 'other@x.com'))
      const sub = score_record('cob', fields_of('Jacob Runner', 'other@x.com'))
      expect(exact).toBeGreaterThan(word)
      expect(word).toBeGreaterThan(sub)
    })

    it('exact word inside field beats substring', () => {
      const word = score_record('runner', fields_of('Jacob Runner', 'x@y.com'))
      const sub = score_record('unn', fields_of('Jacob Runner', 'x@y.com'))
      expect(word).toBeGreaterThan(sub)
    })

    it('field-startsWith beats word-startsWith', () => {
      const field_start = score_record('jac', fields_of('Jacob Runner', 'x@y.com'))
      const word_start = score_record('run', fields_of('Jacob Runner', 'x@y.com'))
      expect(field_start).toBeGreaterThan(word_start)
    })

    it('matches subsequence', () => {
      expect(score_record('jrun', fields_of('Jacob Runner', 'x@y.com'))).toBeGreaterThan(0)
    })

    it('tolerates a transposition typo', () => {
      // 'jcaob' is 'jacob' with a-c swapped → DL distance 1
      const typo = score_record('jcaob', fields_of('Jacob Runner', 'x@y.com'))
      expect(typo).toBeGreaterThan(0)
    })

    it('tolerates a substitution typo', () => {
      // 'jakob' vs 'jacob' → distance 1
      expect(score_record('jakob', fields_of('Jacob Runner', 'x@y.com'))).toBeGreaterThan(0)
    })

    it('rejects unrelated query', () => {
      expect(score_record('xyzpdq', fields_of('Jacob Runner', 'jacob@example.com'))).toBe(0)
    })

    it('requires every token to match (multi-word AND)', () => {
      const all_match = score_record('jacob runner', fields_of('Jacob Runner', 'jacob@x.com'))
      const partial = score_record('jacob xyzpdq', fields_of('Jacob Runner', 'jacob@x.com'))
      expect(all_match).toBeGreaterThan(0)
      expect(partial).toBe(0)
    })

    it('tokens may match across different fields', () => {
      const result = score_record('jacob example', fields_of('Jacob Runner', 'jrun@example.com'))
      expect(result).toBeGreaterThan(0)
    })

    it('matches against aliases (with lower weight)', () => {
      const primary = score_record('jacob', fields_of('Jacob', 'jacob@x.com'))
      const alias_only = score_record('jacob', fields_of('Other Person', 'other@x.com', ['jacob@personal.com']))
      expect(primary).toBeGreaterThan(0)
      expect(alias_only).toBeGreaterThan(0)
      expect(primary).toBeGreaterThan(alias_only)
    })

    it('skips typo tolerance for tokens shorter than 3 chars', () => {
      // 'j' should not match 'k' via edit distance
      expect(score_record('j', fields_of('Karen', 'karen@x.com'))).toBe(0)
    })

    it('matches Stripe customer id', () => {
      expect(score_record('cus_abc', fields_of('Karen', 'karen@x.com', [], 'cus_abc123'))).toBeGreaterThan(0)
    })

    it('orders multiple candidates by relevance', () => {
      const query = 'jacob'
      const candidates = [
        { name: 'Jane Doe', email: 'jane@x.com' }, // no match
        { name: 'Jacob Smith', email: 'jsmith@x.com' }, // word match
        { name: 'jacob', email: 'jacob@x.com' }, // exact
        { name: 'Carol', email: 'jaco.bee@x.com' }, // subsequence-ish in email
      ]
      const ranked = candidates
        .map(c => ({ c, score: score_record(query, fields_of(c.name, c.email)) }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
      expect(ranked.map(r => r.c.name)).toEqual(['jacob', 'Jacob Smith', 'Carol'])
    })
  })
}

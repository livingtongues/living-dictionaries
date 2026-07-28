import { diff_values } from './review-diff'

function changed(side: { text: string, changed: boolean }[]): string[] {
  return side.filter(segment => segment.changed).map(segment => segment.text)
}

function whole(side: { text: string }[]): string {
  return side.map(segment => segment.text).join('')
}

describe(diff_values, () => {
  test('marks nothing when the two versions match', () => {
    const diff = diff_values({ a: 'to point at a thing', b: 'to point at a thing' })
    expect(changed(diff.a)).toEqual([])
    expect(changed(diff.b)).toEqual([])
  })

  test('marks only the words one side omits', () => {
    const diff = diff_values({
      a: 'to point at a particular animate or inanimate thing',
      b: 'to point at a particular inanimate thing',
    })
    expect(changed(diff.a)).toEqual(['animate or '])
    expect(changed(diff.b)).toEqual([])
  })

  test('marks a substituted word on both sides', () => {
    const diff = diff_values({ a: 'refers to a snake', b: 'refers to the snake' })
    expect(changed(diff.a)).toEqual(['a'])
    expect(changed(diff.b)).toEqual(['the'])
  })

  test('narrows a one-letter respelling difference to the letter', () => {
    const diff = diff_values({ a: 'äʼ-bä-chē-zhāʼ', b: 'äʼ-bā-chē-zhāʼ' })
    expect(changed(diff.a)).toEqual(['ä'])
    expect(changed(diff.b)).toEqual(['ā'])
  })

  test('shows a missing comma', () => {
    const diff = diff_values({ a: 'imagine reflect, reason', b: 'imagine, reflect, reason' })
    expect(changed(diff.a)).toEqual([])
    expect(changed(diff.b)).toEqual([','])
  })

  test('shows a spacing-only difference', () => {
    const diff = diff_values({ a: 'God ~ knowledgeable', b: 'God ~knowledgeable' })
    expect(changed(diff.a)).toEqual([' '])
    expect(changed(diff.b)).toEqual([])
  })

  test('keeps every character of both values', () => {
    const a = 'a club composed of a hard stone tied tightly at the end of a strong piece of wood'
    const b = 'Wétįwį̀, Club Woman, proper female name in the Đíxidą̀ clan'
    const diff = diff_values({ a, b })
    expect(whole(diff.a)).toBe(a)
    expect(whole(diff.b)).toBe(b)
  })

  test('marks nothing when the two wordings barely overlap — the whole thing differs', () => {
    const diff = diff_values({ a: 'to strike something, making a dull sound', b: 'a dull, heavy sound made by a heavy object impacting a surface' })
    expect(changed(diff.a)).toEqual([])
    expect(changed(diff.b)).toEqual([])
    expect(whole(diff.a)).toBe('to strike something, making a dull sound')
  })

  test('marks nothing for two unrelated single words', () => {
    const diff = diff_values({ a: 'obtain', b: 'get' })
    expect(changed(diff.a)).toEqual([])
    expect(changed(diff.b)).toEqual([])
  })

  test('handles an empty side', () => {
    const diff = diff_values({ a: '', b: 'a dull, heavy sound' })
    expect(whole(diff.a)).toBe('')
    expect(whole(diff.b)).toBe('a dull, heavy sound')
  })

  test('falls back to whole-value marking for very long values', () => {
    const a = Array.from({ length: 500 }, (_, index) => `word${index}`).join(' ')
    const b = `${a} tail`
    const diff = diff_values({ a, b })
    expect(diff.a).toEqual([{ text: a, changed: true }])
    expect(diff.b).toEqual([{ text: b, changed: true }])
  })
})

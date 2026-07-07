import type { HomepageStats } from './types'

/** Users floors to tens; dictionaries is shown exact (+); everything else floors to hundreds. */
const TENS_STATS: (keyof HomepageStats)[] = ['users']

export function stat_step(stat: keyof HomepageStats): number {
  // dictionaries is a small, curated count (public + unlisted) — show it exact,
  // the trailing "+" already nods at gems buried in the conlang/glossary piles.
  if (stat === 'dictionaries')
    return 1
  return TENS_STATS.includes(stat) ? 10 : 100
}

/** Marketing-rounded stat: floor to the stat's step, locale separators, trailing "+". */
export function round_stat({ value, stat, locale }: { value: number, stat: keyof HomepageStats, locale?: string }): string {
  const step = stat_step(stat)
  const floored = Math.floor(value / step) * step
  return `${floored.toLocaleString(locale || 'en')}+`
}

if (import.meta.vitest) {
  test('users floor to tens', () => {
    expect(round_stat({ value: 5335, stat: 'users' })).toBe('5,330+')
  })
  test('dictionaries shown exact with a trailing +', () => {
    expect(round_stat({ value: 618, stat: 'dictionaries' })).toBe('618+')
  })
  test('content stats floor to hundreds', () => {
    expect(round_stat({ value: 555071, stat: 'entries' })).toBe('555,000+')
    expect(round_stat({ value: 145691, stat: 'audio' })).toBe('145,600+')
    expect(round_stat({ value: 21643, stat: 'photos' })).toBe('21,600+')
    expect(round_stat({ value: 435, stat: 'videos' })).toBe('400+')
  })
  test('locale-aware separators', () => {
    expect(round_stat({ value: 555071, stat: 'entries', locale: 'de' })).toBe('555.000+')
  })
}

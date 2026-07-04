import type { HomepageStats } from './types'

/** Stats floored to tens; everything else floors to hundreds. */
const TENS_STATS: (keyof HomepageStats)[] = ['dictionaries', 'users']

export function stat_step(stat: keyof HomepageStats): number {
  return TENS_STATS.includes(stat) ? 10 : 100
}

/** Marketing-rounded stat: floor to the stat's step, locale separators, trailing "+". */
export function round_stat({ value, stat, locale }: { value: number, stat: keyof HomepageStats, locale?: string }): string {
  const step = stat_step(stat)
  const floored = Math.floor(value / step) * step
  return `${floored.toLocaleString(locale || 'en')}+`
}

if (import.meta.vitest) {
  test('dictionaries and users floor to tens', () => {
    expect(round_stat({ value: 2232, stat: 'dictionaries' })).toBe('2,230+')
    expect(round_stat({ value: 5335, stat: 'users' })).toBe('5,330+')
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

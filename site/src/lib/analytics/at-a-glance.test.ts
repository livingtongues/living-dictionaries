import { describe, expect, test } from 'vitest'
import { build_glance } from './at-a-glance'
import { empty_analytics, mock_analytics } from './mock-analytics'

describe(build_glance, () => {
  test('speaks the people numbers plainly with a week-over-week trend', () => {
    const glance = build_glance({ analytics: mock_analytics })
    expect(glance.people.users).toBe(mock_analytics.totals.unique_users)
    expect(glance.people.headline).toContain('73 people signed in')
    expect(glance.people.headline).toContain('188 visits')
    expect(glance.people.spark).toHaveLength(30)
    expect(glance.people.trend_pct).not.toBe(null)
  })

  test('summarizes experience with the cold-boot pain point', () => {
    const glance = build_glance({ analytics: mock_analytics })
    expect(glance.experience.detail).toContain('load in ~1.2s')
    // within_dictionary p50 = 48ms → "instant" phrasing.
    expect(glance.experience.detail).toContain('instant')
    expect(glance.experience.pain).toContain('First-time open of a dictionary downloads it')
    expect(glance.experience.pain).toContain('1.5s')
  })

  test('names the most-visited dictionaries and top areas', () => {
    const glance = build_glance({ analytics: mock_analytics })
    expect(glance.places?.headline).toBe('Most-visited: Apatani, River Dweller, Galo')
    expect(glance.places?.detail).toContain('US-CA')
  })

  test('turns diagnostics into plain action items with the worst tone winning', () => {
    const glance = build_glance({ analytics: mock_analytics })
    // mock has server faults (act) + stuck sync tabs + stale builds (watch).
    expect(glance.attention.tone).toBe('act')
    expect(glance.attention.items.some(item => item.text.includes('server-side fault'))).toBeTruthy()
    expect(glance.attention.items.some(item => item.text.includes('stuck syncing'))).toBeTruthy()
  })

  test('an empty window reads all-clear, not broken', () => {
    const glance = build_glance({ analytics: empty_analytics })
    expect(glance.attention.tone).toBe('ok')
    expect(glance.attention.items).toEqual([{ tone: 'ok', text: 'Nothing needs your attention right now. 🎉' }])
    expect(glance.people.headline).toContain('0 people')
    expect(glance.experience.pain).toBe(null)
  })
})

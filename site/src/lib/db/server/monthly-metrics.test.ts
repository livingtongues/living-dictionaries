import { describe, expect, test } from 'vitest'
import {
  days_between,
  FIRST_METRICS_MONTH,
  group_for_bucket,
  is_partial_capture,
  last_day_of_month,
  missing_metric_months,
  next_month,
  normalize_visitors,
  normalized_site_visitors,
  VISITOR_ID_STABLE_FROM,
} from './monthly-metrics'
import { open_test_shared_db } from './shared-db'

describe(group_for_bucket, () => {
  test('counts real languages as mission, whether listed publicly or not', () => {
    expect(group_for_bucket('public')).toBe('mission')
    expect(group_for_bucket('unlisted')).toBe('mission')
  })

  test('fences conlang and glossary out of mission reporting', () => {
    expect(group_for_bucket('conlang')).toBe('fenced')
    expect(group_for_bucket('glossary')).toBe('fenced')
  })

  test('excludes the internal test corpus and unbucketed rows from both sides', () => {
    expect(group_for_bucket('secure')).toBe('other')
    expect(group_for_bucket('delete')).toBe('other')
    expect(group_for_bucket(null)).toBe('other')
  })
})

describe(normalize_visitors, () => {
  test('is a NO-OP for a month measured in full — the common case from August on', () => {
    expect(normalize_visitors({ visitors: 8000, days_counted: 31, new_visitor_rate: 258 })).toBe(8000)
  })

  test('never scales DOWN a month longer than the normalization length', () => {
    expect(normalize_visitors({ visitors: 8000, days_counted: 31, new_visitor_rate: 258, days: 30 })).toBe(8000)
  })

  test('extends July forward at the measured arrival rate, not by linear scaling', () => {
    // 5,182 devices over 24 days => 215.9/day. Linear scaling (5182 * 31/24 =
    // 6,694) happens to be close ONLY because the rate is flat; the point is
    // that we add arrivals rather than multiply a union.
    expect(normalize_visitors({ visitors: 5182, days_counted: 24, new_visitor_rate: 5182 / 24 })).toBe(6693)
  })

  test('adds nothing when the arrival rate is zero', () => {
    expect(normalize_visitors({ visitors: 10, days_counted: 5, new_visitor_rate: 0 })).toBe(10)
  })
})

describe(normalized_site_visitors, () => {
  test('reads the site columns off a metrics row', () => {
    expect(normalized_site_visitors({ site_visitors: 5182, days_counted: 24, new_visitor_rate: 5182 / 24 })).toBe(6693)
  })
})

describe(is_partial_capture, () => {
  test('flags July 2026, the only month with a truncated capture window', () => {
    expect(is_partial_capture({ month: '2026-07', days_counted: 24 })).toBeTruthy()
  })

  test('does not flag a fully measured 31-day month', () => {
    expect(is_partial_capture({ month: '2026-08', days_counted: 31 })).toBeFalsy()
  })

  test('does not flag a fully measured 30-day month', () => {
    expect(is_partial_capture({ month: '2026-09', days_counted: 30 })).toBeFalsy()
  })
})

describe(last_day_of_month, () => {
  test('handles 31-, 30- and 28-day months', () => {
    expect(last_day_of_month('2026-07')).toBe('2026-07-31')
    expect(last_day_of_month('2026-09')).toBe('2026-09-30')
    expect(last_day_of_month('2026-02')).toBe('2026-02-28')
  })
})

describe(days_between, () => {
  test('is inclusive of both ends — July 8 to July 31 is 24 days', () => {
    expect(days_between({ from: '2026-07-08', to: '2026-07-31' })).toBe(24)
  })
})

describe(next_month, () => {
  test('rolls the year over', () => {
    expect(next_month('2026-12')).toBe('2027-01')
    expect(next_month('2026-07')).toBe('2026-08')
  })
})

describe(missing_metric_months, () => {
  function db_with(months: string[]) {
    const db = open_test_shared_db()
    for (const month of months) {
      db.prepare(`INSERT INTO monthly_metrics (
        month, window_start, window_end, days_counted, site_visitors, site_visits, site_anon_visitors,
        new_visitor_rate, mission_visitors, mission_visits, mission_anon_visitors, fenced_visitors,
        public_dictionaries, public_entries, platform_dictionaries, platform_entries,
        mission_entries_created, mission_entries_agent, mission_entries_hand,
        mission_entries_unattributed, fenced_entries_created, computed_at
      ) VALUES (?, '2026-01-01', '2026-01-31', 31, 0,0,0, 0, 0,0,0,0, 0,0,0,0, 0,0,0,0,0, '2026-01-01T00:00:00.000Z')`).run(month)
    }
    return db
  }

  test('backfills July on a first deploy in August', () => {
    expect(missing_metric_months({ shared_db: db_with([]), now: new Date('2026-08-01T12:00:00Z') })).toEqual(['2026-07'])
  })

  test('never reaches back before the first device-keyed month', () => {
    const months = missing_metric_months({ shared_db: db_with([]), now: new Date('2026-10-05T00:00:00Z') })
    expect(months).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(months.every(month => month >= FIRST_METRICS_MONTH)).toBeTruthy()
  })

  test('excludes the in-progress current month — a month is only measured once whole', () => {
    expect(missing_metric_months({ shared_db: db_with(['2026-07']), now: new Date('2026-08-14T00:00:00Z') })).toEqual([])
  })

  test('returns nothing once every completed month is stored', () => {
    expect(missing_metric_months({ shared_db: db_with(['2026-07', '2026-08']), now: new Date('2026-09-02T00:00:00Z') })).toEqual([])
  })
})

describe('capture-window constants', () => {
  test('starts July at the date device ids became reliable, not at the 1st', () => {
    // Guards the whole point of the window columns: before this date the visitor
    // union falls back to session_id and every session counts as its own device.
    expect(VISITOR_ID_STABLE_FROM > `${FIRST_METRICS_MONTH}-01`).toBeTruthy()
    expect(VISITOR_ID_STABLE_FROM.slice(0, 7)).toBe(FIRST_METRICS_MONTH)
  })
})

import type { DictionaryView } from '@living-dictionaries/types'

/**
 * Tiny placeholder dictionary catalog for the M1 stub (Supabase removed). Lets the
 * homepage globe + /dictionaries list render something while there's no real data
 * path. Typed as the real `DictionaryView` so it can't drift from the schema.
 * Coordinates use the legacy nested shape the globe reads:
 * `coordinates.points[0].coordinates.{longitude,latitude}`.
 * Replace with a real read path in M4.
 */
function dict(overrides: Partial<DictionaryView>): DictionaryView {
  return {
    alternate_names: null,
    author_connection: null,
    community_permission: null,
    con_language_description: null,
    coordinates: null,
    copyright: null,
    created_at: null,
    created_by: null,
    entry_count: null,
    featured_image: null,
    gloss_languages: ['en'],
    glottocode: null,
    id: null,
    language_used_by_community: null,
    location: null,
    metadata: null,
    name: null,
    orthographies: null,
    print_access: null,
    public: true,
    updated_at: '2024-01-01T00:00:00Z',
    updated_by: null,
    url: null,
    ...overrides,
  } as DictionaryView
}

function at(longitude: number, latitude: number) {
  return { points: [{ coordinates: { longitude, latitude } }] }
}

export const dummy_dictionaries: DictionaryView[] = [
  dict({ id: 'achi', url: 'achi', name: 'Achi', location: 'Guatemala', coordinates: at(-90.4, 15.1), entry_count: 1240, glottocode: 'achi1257' }),
  dict({ id: 'gta', url: 'gta', name: 'GtaɁ', location: 'Odisha, India', coordinates: at(82.5, 18.8), entry_count: 2103, glottocode: 'gata1239' }),
  dict({ id: 'kihunde', url: 'kihunde', name: 'Kihunde', location: 'North Kivu, DRC', coordinates: at(29.0, -0.6), entry_count: 942, glottocode: 'hund1238' }),
  dict({ id: 'ainu', url: 'ainu', name: 'Ainu', location: 'Hokkaido, Japan', coordinates: at(142.0, 43.0), entry_count: 1580, glottocode: 'ainu1240' }),
  dict({ id: 'quechua', url: 'quechua', name: 'Quechua', location: 'Cusco, Peru', coordinates: at(-71.97, -13.5), entry_count: 4120, glottocode: 'cusc1236' }),
  dict({ id: 'nahuatl', url: 'nahuatl', name: 'Nahuatl', location: 'Puebla, Mexico', coordinates: at(-98.2, 19.0), entry_count: 2680, glottocode: 'high1278' }),
  dict({ id: 'maori', url: 'maori', name: 'Māori', location: 'Aotearoa New Zealand', coordinates: at(176.0, -38.0), entry_count: 5230, glottocode: 'maor1246' }),
  dict({ id: 'welsh', url: 'welsh', name: 'Welsh', location: 'Wales', coordinates: at(-3.8, 52.1), entry_count: 6740, glottocode: 'wels1247' }),
  dict({ id: 'hawaiian', url: 'hawaiian', name: 'Hawaiian', location: 'Hawaiʻi', coordinates: at(-156.3, 20.8), entry_count: 3890, glottocode: 'hawa1245' }),
  dict({ id: 'sami', url: 'sami', name: 'Northern Sámi', location: 'Sápmi, Norway', coordinates: at(23.0, 69.6), entry_count: 2470, glottocode: 'nort2671' }),
  dict({ id: 'cherokee', url: 'cherokee', name: 'Cherokee', location: 'North Carolina, USA', coordinates: at(-83.3, 35.5), entry_count: 3470, glottocode: 'cher1273' }),
  dict({ id: 'basque', url: 'basque', name: 'Basque', location: 'Basque Country, Spain', coordinates: at(-2.6, 43.1), entry_count: 7320, glottocode: 'basq1248' }),
]

import type { FeaturedCard, MapDict } from './types'
import en from '$lib/i18n/locales/en.json'
import baked from '$lib/data/homepage-baked.json'

/** EN-resolving t() mock for stories (keys render as real copy, not raw key paths). */
export const story_t = ((key: string, options?: { values?: Record<string, string> }) => {
  const [namespace, ...rest] = key.split('.')
  let value = (en as unknown as Record<string, Record<string, string>>)[namespace]?.[rest.join('.')] ?? key
  for (const [name, replacement] of Object.entries(options?.values ?? {}))
    value = value.replace(`{${name}}`, replacement)
  return value
}) as never

export const story_cards: FeaturedCard[] = (baked.featured_entries as FeaturedCard[]).slice(0, 12)

export const story_dicts: MapDict[] = [
  { id: 'achi', url: 'achi', name: 'Achi', lat: 15.05, lng: -90.35, entry_count: 1500, gloss_languages: ['es', 'en'], location: 'Guatemala', alternate_names: [] },
  { id: 'gta', url: 'gta', name: 'GtaɁ', lat: 18.617, lng: 82.991, entry_count: 6378, gloss_languages: ['en', 'or'], location: 'Odisha, India', alternate_names: ['Didayi'] },
  { id: 'kihunde', url: 'kihunde', name: 'Kihunde', lat: -1.667, lng: 29.05, entry_count: 6648, gloss_languages: ['fr', 'sw', 'en'], location: 'DRC', alternate_names: [] },
  { id: 'northern-michif', url: 'northern-michif', name: 'Northern Michif', lat: 53.5863, lng: -116.4416, entry_count: 1019, gloss_languages: ['en'], location: 'Canada', alternate_names: [] },
  { id: 'nukuoro', url: 'nukuoro', name: 'Nukuoro', lat: 3.845, lng: 154.96, entry_count: 6613, gloss_languages: ['en'], location: 'Micronesia', alternate_names: [] },
  { id: 'sibe', url: 'sibe', name: 'Manchu', lat: 43.801, lng: 81.087, entry_count: 2660, gloss_languages: ['cmn', 'en'], location: 'Xinjiang, China', alternate_names: ['Sibe'] },
]

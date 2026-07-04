import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import type { DictHomeCard } from '$lib/db/server/dict-home'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'
import { story_cards } from '$lib/components/home-v2/story-helpers'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t, locale: 'en' },
}

const ssr_cards: DictHomeCard[] = story_cards.slice(0, 6).map(card => ({
  id: card.id,
  entry_id: card.entry_id,
  lexeme: { default: card.lexeme },
  phonetic: null,
  glosses: card.gloss ? { [card.gloss_language ?? 'en']: card.gloss } : null,
  photo_serving_url: card.photo_serving_url,
  audio_storage_path: card.audio_storage_path,
}))

const dictionary = {
  id: 'gta',
  url: 'gta',
  name: 'GtaɁ',
  location: 'Odisha, India',
  iso_639_3: 'gaq',
  glottocode: 'gata1239',
  public: 1,
  alternate_names: ['Didayi', 'Gata'],
  gloss_languages: ['en', 'or', 'hi'],
  coordinates: { points: [{ coordinates: { longitude: 82.991, latitude: 18.617 } }] },
  featured_image: { serving_url: story_cards[0]?.photo_serving_url },
  about: '<p>GtaɁ (also known as Didayi) is a Munda language spoken by the Didayi people of Odisha, India. This dictionary documents the language as spoken in the Koraput district, with audio recordings from native speakers across three generations.</p><p>Second paragraph that should not appear.</p>',
  grammar: '<p>GtaɁ is an agglutinative language with subject-object-verb word order. Nouns inflect for number and case.</p>',
  citation: null,
  entry_count: 6378,
  orthographies: null,
  con_language_description: null,
  hide_living_tongues_logo: 0,
}

const loading_entries_data = Object.assign(readable({}), { loading: readable(true) })
const base = {
  dictionary,
  ssr_featured: ssr_cards.slice(0, 5),
  ssr_recent: ssr_cards.slice(3, 6),
  partners: [],
  dict_db: null,
  entries_data: loading_entries_data,
  speakers: readable([]),
  search_entries: async () => ({ count: 0, facets: {} }),
  search_index_updated: readable(false),
  auth_user: { admin_level: 0, user: null },
  is_manager: false,
  can_edit: false,
  is_editor_or_above: false,
} as never

/** Anonymous visitor, snapshot still downloading — SSR cards + pulsing stats. */
export const Visitor: PageStory<typeof Component> = {
  viewports: [{ width: 1024, height: 1200 }, { width: 390, height: 1400 }],
  props: base,
}

/** Manager of a bare dictionary — nudges, dashed add-location, no hero image. */
export const ManagerBareDict: PageStory<typeof Component> = {
  viewports: [{ width: 1024, height: 1000 }],
  props: {
    ...(base as object),
    dictionary: { ...dictionary, featured_image: null, coordinates: null, about: null, grammar: null, alternate_names: null },
    ssr_featured: [],
    ssr_recent: ssr_cards.slice(0, 3),
    is_manager: true,
    can_edit: true,
    is_editor_or_above: true,
    auth_user: { admin_level: 0, user: { id: 'u1' } },
  } as never,
}

/** Admin-3 with the local index ready — stats count up + the gated domains panel. */
export const AdminLoadedStats: PageStory<typeof Component> = {
  viewports: [{ width: 1024, height: 1500 }],
  csr: true,
  interactions: async (page) => {
    await page.waitForFunction(() => document.body.textContent?.includes('6,378'), { timeout: 4000 })
  },
  props: {
    ...(base as object),
    entries_data: Object.assign(readable({}), { loading: readable(false) }),
    speakers: readable([{ id: 's1' }, { id: 's2' }, { id: 's3' }]),
    search_entries: async () => ({
      count: 6378,
      facets: {
        has_audio: { values: { true: 5120, false: 1258 } },
        has_image: { values: { true: 940, false: 5438 } },
        has_video: { values: { true: 82, false: 6296 } },
        _semantic_domains: { values: { Body_parts: 412, Animals: 388, Plants: 301, Food_and_drink: 244, Kinship: 199, Motion: 150, Tools: 96, Weather: 71 } },
      },
    }),
    auth_user: { admin_level: 3, user: { id: 'admin' } },
  } as never,
}

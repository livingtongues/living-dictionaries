import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'
import type { DictHomeCard } from '$lib/db/server/dict-home'
import { readable } from 'svelte/store'
import { mock_t } from '$lib/mocks/mock-t'
import { story_cards } from '$lib/components/home-v2/story-helpers'

export const shared_meta: StoryMeta = {
  page_data: { t: mock_t, locale: 'en' },
}

const ssr_cards: DictHomeCard[] = story_cards.slice(0, 6).map((card, index) => ({
  id: card.id,
  entry_id: card.entry_id,
  lexeme: { default: card.lexeme },
  phonetic: index % 2 === 0 ? card.lexeme.toLowerCase() : null,
  glosses: card.gloss ? { [card.gloss_language ?? 'en']: card.gloss } : null,
  parts_of_speech: index % 3 === 0 ? ['n'] : null,
  dialect: null,
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
  // Markdown (as stored) — the escaped \[gaq\] must render as [gaq] in the snippet.
  about: String.raw`GtaɁ \[gaq\] (also known as **Didayi**) is a Munda language spoken by the Didayi people of Odisha, India. This dictionary documents the language as spoken in the Koraput district, with audio recordings from native speakers across three generations. The materials were collected, annotated and transcribed by researchers working alongside community members, under the auspices of a long-running documentation project that continues to add new entries every year.`,
  grammar: 'GtaɁ is an *agglutinative* language with subject-object-verb word order. Nouns inflect for number and case.',
  citation: null,
  entry_count: 6378,
  orthographies: [{ code: 'default', name: 'Gtaʔ', primary: true }, { code: 'ipa', name: 'IPA' }],
  con_language_description: null,
  hide_living_tongues_logo: 0,
}

const loading_entries_data = Object.assign(readable({}), { loading: readable(true) })
const base = {
  dictionary,
  home_data: {
    ssr_featured: ssr_cards.slice(0, 5),
    ssr_recent: ssr_cards.slice(3, 6),
    partners: [],
  },
  dict_db: null,
  entries_data: loading_entries_data,
  speakers: readable([]),
  search_entries: async () => ({ count: 0, facets: {} }),
  search_index_updated: readable(0),
  auth_user: { admin_level: 0, user: null },
  is_manager: false,
  can_edit: false,
  is_editor_or_above: false,
  update_dictionary: async () => {},
} as never

/** Anonymous visitor, snapshot still downloading — SSR cards + pulsing stats. */
export const Visitor: PageStory<typeof Component> = {
  viewports: [{ width: 1600, height: 1200 }, { width: 390, height: 1400 }],
  props: base,
}

/** Manager of a bare dictionary — nudges, dashed add-pills, cover-photo button, no hero image. */
export const ManagerBareDict: PageStory<typeof Component> = {
  viewports: [{ width: 1024, height: 1000 }],
  props: {
    ...(base as object),
    dictionary: { ...dictionary, featured_image: null, coordinates: null, about: null, grammar: null, alternate_names: null, location: null, iso_639_3: null, glottocode: null, orthographies: null },
    home_data: { ssr_featured: [], ssr_recent: ssr_cards.slice(0, 3), partners: [] },
    is_manager: true,
    can_edit: true,
    is_editor_or_above: true,
    auth_user: { admin_level: 0, user: { id: 'u1' } },
  } as never,
}

/** Manager with a full hero — pencil affordances on every field + replace/remove cover. */
export const ManagerFullHero: PageStory<typeof Component> = {
  viewports: [{ width: 1280, height: 900 }],
  props: {
    ...(base as object),
    is_manager: true,
    can_edit: true,
    is_editor_or_above: true,
    auth_user: { admin_level: 0, user: { id: 'u1' } },
  } as never,
}

/** Local index ready — stats count up + the public domains pie (>2 domains in use).
 *  1024 = domains stacked above cite; 1600 = 50/50 once the row is ≥ ~1300px. */
export const LoadedStats: PageStory<typeof Component> = {
  viewports: [{ width: 1024, height: 1500 }, { width: 1600, height: 1200 }],
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
    auth_user: { admin_level: 0, user: null },
  } as never,
}

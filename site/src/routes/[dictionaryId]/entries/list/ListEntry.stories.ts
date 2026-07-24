import type { Story, StoryMeta } from 'svelte-look'
import type Component from './ListEntry.svelte'
import type { EntryData, Tables } from '$lib/types'
import type { GuardedWrites } from '$lib/db/dict-client/guarded-writes'
import { mock_t } from '$lib/mocks/mock-t'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 700, height: 110 }],
  page_data: {
    t: mock_t,
    url_from_storage_path: (path: string) => `/api/dev-media/${path}`,
  },
}

const dictionary = {
  id: 'demo',
  url: 'demo',
  gloss_languages: ['en'],
  orthographies: [
    { code: 'default', name: 'Latin', primary: true },
    { code: 'x-olck', name: 'Ol Chiki' },
    { code: 'x-deva', name: 'Devanagari' },
  ],
} as unknown as Tables<'dictionaries'>

const bilingual_dictionary = {
  ...dictionary,
  gloss_languages: ['es', 'en'],
} as unknown as Tables<'dictionaries'>

const mock_audio = { id: 'a1', storage_path: 'demo/audio/a1.mp3', updated_at: '2026-01-01T00:00:00Z' } as unknown as NonNullable<EntryData['audios']>[0]
const mock_photo = { id: 'p1', serving_url: '', storage_path: null } as unknown as NonNullable<EntryData['senses'][0]['photos']>[0]
// R2-convention photo whose variant webps exist in the local dev-media store (real image bytes in stories).
const mock_photo_real = { id: 'p2', serving_url: '', storage_path: 'demo/photo/9f000000-0000-4000-8000-000000000001.jpg' } as unknown as NonNullable<EntryData['senses'][0]['photos']>[0]
// Legacy (non-R2) storage path → no derivable thumbnail → icon-chip fallback.
const mock_video = { id: 'v1', storage_path: 'demo/video/v1.mp4' } as unknown as NonNullable<EntryData['senses'][0]['videos']>[0]
// R2-convention path → `_thumb.webp` sibling requested (dev store serves a placeholder when absent).
const mock_video_with_thumb = { id: 'v2', storage_path: 'demo/video/48af49b0-b410-4db1-babf-38ac53269e62.mp4' } as unknown as NonNullable<EntryData['senses'][0]['videos']>[0]

function make_entry(lexeme: Record<string, string>, main_extra: Record<string, unknown> = {}): EntryData {
  return {
    id: 'e1',
    updated_at: '2026-01-01T00:00:00Z',
    main: { lexeme, phonetic: 'foo', ...main_extra },
    senses: [{ id: 's1', glosses: { en: 'water' } }],
  } as unknown as EntryData
}

function full_entry({ senses, audios, main_extra, dialects }: {
  senses?: Partial<EntryData['senses'][0]>[]
  audios?: EntryData['audios']
  main_extra?: Record<string, unknown>
  dialects?: EntryData['dialects']
} = {}): EntryData {
  return {
    id: 'e1',
    updated_at: '2026-01-01T00:00:00Z',
    main: { lexeme: { default: 'anetsochor' }, phonetic: 'a.net.so.tʃor', ...main_extra },
    senses: (senses || [{ glosses: { en: 'village' } }]).map((sense, index) => ({ id: `s${index}`, ...sense })),
    ...(audios && { audios }),
    ...(dialects && { dialects }),
  } as unknown as EntryData
}

const shared_props = {
  dictionary,
  can_edit: false,
  writes: {} as GuardedWrites,
}

// ————— headword/orthography cases (original) —————

export const DefaultHeadwordWithAlternate: Story<typeof Component> = {
  props: { ...shared_props, entry: make_entry({ 'default': 'atl', 'x-olck': 'atl-in-olck' }) },
}

export const NoDefaultFallsBackToAlternate: Story<typeof Component> = {
  props: { ...shared_props, entry: make_entry({ 'x-deva': 'atl-in-deva' }) },
}

export const HomographNumberSuperscript: Story<typeof Component> = {
  props: { ...shared_props, entry: make_entry({ default: 'caws' }, { homograph: '3' }) },
}

// ————— gloss / definition content cases —————

export const GlossOnly: Story<typeof Component> = {
  props: { ...shared_props, entry: full_entry({ senses: [{ glosses: { en: 'village' } }] }) },
}

export const MultipleGlossLanguages: Story<typeof Component> = {
  props: {
    ...shared_props,
    dictionary: bilingual_dictionary,
    entry: full_entry({ senses: [{ glosses: { es: 'aldea', en: 'village' } }] }),
  },
}

export const DefinitionOnlyCurrentlyInvisible: Story<typeof Component> = {
  props: {
    ...shared_props,
    dictionary: bilingual_dictionary,
    entry: full_entry({
      senses: [{ definition: { es: 'clítico que muchas veces actúa como afijo que acompaña a ciertos verbos o adverbios de la sexta conjugación' } }],
      main_extra: { lexeme: { default: '-Exma' }, phonetic: null },
    }),
  },
}

export const GlossAndDefinition: Story<typeof Component> = {
  props: {
    ...shared_props,
    dictionary: bilingual_dictionary,
    entry: full_entry({
      senses: [{
        glosses: { es: 'madre, mamá' },
        definition: { es: 'término de parentesco para la progenitora; usado también para tías maternas en el habla tradicional' },
      }],
    }),
  },
}

export const LexemeOnlyNoSenseContent: Story<typeof Component> = {
  props: {
    ...shared_props,
    entry: full_entry({ senses: [{}], main_extra: { lexeme: { default: 'Agkaméko' }, phonetic: null } }),
  },
}

export const MultipleSensesOnlyFirstShows: Story<typeof Component> = {
  props: {
    ...shared_props,
    entry: full_entry({
      senses: [
        { glosses: { en: 'hair' } },
        { glosses: { en: 'leaf (of tree, plant)' } },
        { glosses: { en: 'page of a book' } },
        { glosses: { en: 'feather' } },
      ],
      main_extra: { lexeme: { default: 'Áwa’' } },
    }),
  },
}

export const KitchenSinkMetadata: Story<typeof Component> = {
  viewports: [{ width: 700, height: 160 }],
  props: {
    ...shared_props,
    entry: full_entry({
      senses: [{
        glosses: { en: 'moon, month' },
        parts_of_speech: ['n'],
        semantic_domains: ['1.1'],
        write_in_semantic_domains: ['Time'],
        plural_form: { default: 'arrórres' },
      }],
      main_extra: { scientific_names: ['<i>Luna maxima</i>'], homograph: '2' },
      dialects: [{ id: 'd1', name: { default: 'Northern' } }] as unknown as EntryData['dialects'],
    }),
  },
}

// ————— media cases: visitor —————

export const VisitorAllMedia: Story<typeof Component> = {
  props: {
    ...shared_props,
    entry: full_entry({
      senses: [{ glosses: { en: 'village' }, photos: [mock_photo_real], videos: [mock_video] }],
      audios: [mock_audio],
    }),
  },
}

export const VisitorAudioOnly: Story<typeof Component> = {
  props: {
    ...shared_props,
    entry: full_entry({ senses: [{ glosses: { en: 'village' } }], audios: [mock_audio] }),
  },
}

export const VisitorPhotoStack: Story<typeof Component> = {
  props: {
    ...shared_props,
    entry: full_entry({ senses: [{ glosses: { en: 'village' }, photos: [mock_photo_real, mock_photo] }] }),
  },
}

// ————— media cases: editor —————

export const EditorNoMedia: Story<typeof Component> = {
  props: {
    ...shared_props,
    can_edit: true,
    entry: full_entry({ senses: [{ glosses: { en: 'village' } }] }),
  },
}

export const EditorAllMedia: Story<typeof Component> = {
  props: {
    ...shared_props,
    can_edit: true,
    entry: full_entry({
      senses: [{ glosses: { en: 'village' }, photos: [mock_photo_real], videos: [mock_video] }],
      audios: [mock_audio],
    }),
  },
}

export const EditorAudioOnlyRestPlaceholders: Story<typeof Component> = {
  props: {
    ...shared_props,
    can_edit: true,
    entry: full_entry({ senses: [{ glosses: { en: 'village' } }], audios: [mock_audio] }),
  },
}

// ————— media rail states —————

export const VideoThumbnail: Story<typeof Component> = {
  props: {
    ...shared_props,
    entry: full_entry({
      senses: [{ glosses: { en: 'village' }, videos: [mock_video_with_thumb] }],
    }),
  },
}

export const FlushRailShortCard: Story<typeof Component> = {
  csr: true,
  props: {
    ...shared_props,
    entry: full_entry({
      senses: [{ glosses: { en: 'village' }, photos: [mock_photo_real], videos: [mock_video_with_thumb] }],
    }),
  },
}

export const FloatingRailTallCard: Story<typeof Component> = {
  viewports: [{ width: 700, height: 220 }],
  csr: true,
  props: {
    ...shared_props,
    dictionary: bilingual_dictionary,
    entry: full_entry({
      senses: [{
        glosses: { es: 'casa comunal', en: 'communal house' },
        definition: { es: 'construcción tradicional donde se reúne la comunidad para asambleas y ceremonias; se transmite de generación en generación y su mantenimiento es responsabilidad compartida de todas las familias' },
        photos: [mock_photo_real, mock_photo],
        semantic_domains: ['5.1'],
      }],
      audios: [mock_audio],
    }),
  },
}

// ————— mobile —————

export const MobileVisitorGlossOnly: Story<typeof Component> = {
  viewports: [{ width: 375, height: 130 }],
  props: {
    ...shared_props,
    entry: full_entry({ senses: [{ glosses: { en: 'round' }, semantic_domains: ['8.2'] }] }),
  },
}

export const MobileVisitorAllMedia: Story<typeof Component> = {
  viewports: [{ width: 375, height: 130 }],
  props: {
    ...shared_props,
    entry: full_entry({
      senses: [{ glosses: { en: 'village' }, photos: [mock_photo_real], videos: [mock_video] }],
      audios: [mock_audio],
    }),
  },
}

export const MobileEditorNoMedia: Story<typeof Component> = {
  viewports: [{ width: 375, height: 130 }],
  props: {
    ...shared_props,
    can_edit: true,
    entry: full_entry({ senses: [{ glosses: { en: 'village' } }] }),
  },
}

export const EditorMenuOpen: Story<typeof Component> = {
  viewports: [{ width: 700, height: 260 }],
  csr: true,
  interactions: async (puppeteer_page) => {
    await puppeteer_page.click('.menu-button')
    await puppeteer_page.waitForSelector('.menu-items')
  },
  props: {
    ...shared_props,
    can_edit: true,
    entry: full_entry({ senses: [{ glosses: { en: 'village' } }], audios: [mock_audio] }),
  },
}

export const MobileEditorAllMedia: Story<typeof Component> = {
  viewports: [{ width: 375, height: 130 }],
  props: {
    ...shared_props,
    can_edit: true,
    entry: full_entry({
      senses: [{ glosses: { en: 'round / circular shape' }, photos: [mock_photo_real], videos: [mock_video], parts_of_speech: ['adj'], semantic_domains: ['8.2'] }],
      audios: [mock_audio],
    }),
  },
}

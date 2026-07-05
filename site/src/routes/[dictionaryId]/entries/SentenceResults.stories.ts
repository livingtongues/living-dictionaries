import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SentenceResults.svelte'
import { mock_t } from '$lib/mocks/mock-t'

const sentences = {
  s1: {
    id: 's1',
    text: { default: 'Chila xril jun bʼalam' },
    translation: { es: 'Allí vio un jaguar' },
    text_id: 't1',
  },
  s2: {
    id: 's2',
    text: { 'default': 'Nak tore', 'lo-alt': 'nak toré' },
    translation: { en: 'Good morning', es: 'Buenos días' },
    text_id: null,
  },
  s3: {
    id: 's3',
    text: { default: 'Utz awach' },
    translation: null,
    text_id: null,
  },
}

const mock_dict_db = {
  sentences: { id: (id: string) => sentences[id] },
  texts: { objects: { t1: { id: 't1', title: { default: 'Ri kʼutunik re juyubʼ' } } } },
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 640, height: 400 }],
  page_data: {
    t: mock_t,
    dictionary: { id: 'demo', url: 'demo', orthographies: [{ code: 'default', name: 'Latin' }, { code: 'lo-alt', name: 'Alternate' }] },
    dict_db: mock_dict_db,
  },
}

export const Mixed: Story<typeof Component> = {
  props: {
    hits: [
      { id: 's1', document: { in_text: true, has_audio: true, has_image: false, has_video: false, _text_id: 't1' } },
      { id: 's2', document: { in_text: false, has_audio: false, has_image: true, has_video: true, _text_id: null } },
      { id: 's3', document: { in_text: false, has_audio: false, has_image: false, has_video: false, _text_id: null } },
    ],
  },
}

export const Empty: Story<typeof Component> = {
  viewports: [{ width: 640, height: 80 }],
  props: { hits: [] },
}

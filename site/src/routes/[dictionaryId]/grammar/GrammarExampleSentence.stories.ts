import type { Story, StoryMeta } from 'svelte-look'
import type Component from './GrammarExampleSentence.svelte'
import { mock_t } from '$lib/mocks/mock-t'

const dictionary = {
  id: 'demo',
  url: 'demo',
  name: 'Nahuatl',
  gloss_languages: ['en'],
  orthographies: [{ code: 'default', name: 'Latin' }],
} as never

export const shared_meta: StoryMeta = {
  viewports: [{ width: 520, height: 180 }],
  page_data: { t: mock_t, dictionary },
}

export const Plain: Story<typeof Component> = {
  props: {
    sentence: { id: 'x1', text: { default: 'Nō-cal-tzin' }, translation: { en: 'my dear little house' } },
    link: false,
  } as never,
}

export const WithDiscourseAndLabel: Story<typeof Component> = {
  props: {
    sentence: {
      id: 'x2',
      text: { default: 'Ō-mo-miquilih in tlācatl' },
      translation: { en: 'The man died (honorific).' },
      discourse_role: 'storyline',
      example_label: '(2a)',
    },
    link: false,
  } as never,
}

import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SearchInput.svelte'
import type { QueryParams } from '$lib/search/types'
import type { QueryParamState } from '$lib/state/query-param-state.svelte'
import { mock_t } from '$lib/mocks/mock-t'

function mock_search_params(value: Partial<QueryParams>): QueryParamState<QueryParams> {
  return { value: { page: 1, query: '', ...value }, update: () => {}, remove: () => {} } as any
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 500, height: 110 }],
  page_data: { t: mock_t },
}

const shared_props = {
  on_show_filter_menu: () => {},
  index_ready: true,
}

export const NoSpecialCharacters: Story<typeof Component> = {
  props: { ...shared_props, search_params: mock_search_params({}) },
}

export const WithSpecialCharacters: Story<typeof Component> = {
  props: {
    ...shared_props,
    search_params: mock_search_params({ query: 'wađe' }),
    special_characters: ['đ', 'ʼ', 'ą', 'ę', 'į', 'ų', 'ǫ', 'š', 'ž', 'č', 'ʃ', 'ə', '·'],
  },
}

export const TypingACharacter: Story<typeof Component> = {
  csr: true,
  interactions: async (page) => {
    await page.click('input[type=search]')
    await page.type('input[type=search]', 'wa')
    const buttons = await page.$$('.character-row button')
    await buttons[0].click()
    await buttons[1].click()
  },
  props: {
    ...shared_props,
    search_params: mock_search_params({}),
    special_characters: ['đ', 'ʼ', 'ą', 'ę', 'į', 'ų', 'ǫ', 'š', 'ž', 'č', 'ʃ', 'ə', '·'],
  },
}

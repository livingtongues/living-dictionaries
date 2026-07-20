import type { Story, StoryMeta } from 'svelte-look'
import type Component from './SearchScopeChips.svelte'
import type { QueryParams } from '$lib/search/types'
import type { QueryParamState } from '$lib/state/query-param-state.svelte'
import { mock_t } from '$lib/mocks/mock-t'

function mock_search_params(value: Partial<QueryParams>): QueryParamState<QueryParams> {
  return { value: { page: 1, query: '', ...value }, update: () => {}, remove: () => {} } as any
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 400, height: 50 }],
  page_data: { t: mock_t },
}

export const WordsActive: Story<typeof Component> = {
  props: { search_params: mock_search_params({}) },
}

export const SentencesActive: Story<typeof Component> = {
  props: { search_params: mock_search_params({ scope: 'sentences' }) },
}

export const TextsActive: Story<typeof Component> = {
  props: { search_params: mock_search_params({ scope: 'texts' }) },
}

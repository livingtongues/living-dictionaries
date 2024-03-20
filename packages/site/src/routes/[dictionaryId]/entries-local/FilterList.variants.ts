import type { Variant, Viewport } from 'kitbook'
import type Component from './FilterList.svelte'
import { writable } from 'svelte/store'
import type { QueryParamStore } from 'svelte-pieces'
import type { QueryParams } from '$lib/search/types'

export const viewports: Viewport[] = [
  { width: 200, height: 500 },
]

export const variants: Variant<Component>[] = [
  // TODO: no search params variant
  {
    name: 'Few',
    viewports: [
      { width: 200, height: 100 },
    ],
    props: {
      label: 'Dialect',
      search_params: writable({ dialects: ['north'] }) as QueryParamStore<QueryParams>,
      search_param_key: 'dialects',
      // count: 3,
      values: {
        'west': 2,
        'east': 1,
        'north': 10,
      }
    },
  },
  {
    name: 'Many',
    props: {
      label: 'Dialect',
      search_params: writable({ dialects: ['north'] }) as QueryParamStore<QueryParams>,
      search_param_key: 'dialects',
      // count: 13,
      values: {
        'west': 2,
        'east': 1,
        'north': 10,
        'south': 5,
        'central': 3,
        'north west': 2,
        'north east': 1,
        'south east': 10,
        'south west': 5,
        'central west': 3,
        'central east': 2,
        'northwest west': 1,
        'northeast west': 10,
      }
    },
  },
]

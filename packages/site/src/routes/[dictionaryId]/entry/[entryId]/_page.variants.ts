import type { Variant } from 'kitbook';
import type Component from './+page.svelte';
import { readable } from 'svelte/store';
import { logDbOperations } from '$lib/mocks/db';
import type { ComponentProps } from 'svelte';
import { mockDictionaryLayoutData } from '$lib/mocks/layout';

const defaultProps: ComponentProps<Component>['data'] = {
  ...mockDictionaryLayoutData,
  dbOperations: logDbOperations,
  supaEntry: null,
  initialEntry: readable({
    lx: 'test',
  })
}

export const variants: Variant<Component>[] = [
  {
    name: 'Viewer',
    viewports: [{ width: 500, height: 250}],
    props: {
      data: {
        ...defaultProps,
        initialEntry: readable({
          lx: 'test',
          gl: {
            'en': 'foo',
          }
        })
      },
    },
  },
  {
    name: 'Editor',
    viewports: [{ width: 786, height: 500}],
    props: {
      data: {
        ...defaultProps,
        is_manager: readable(true),
        can_edit: readable(true),
      },
    },
  },
  {
    name: 'Admin 2',
    description: 'Will show JSON viewer and Add Sense (as it is in beta)',
    languages: [],
    viewports: [{ width: 786, height: 500}],
    props: {
      data: {
        ...defaultProps,
        admin: readable(2),
        can_edit: readable(true),
      },
    },
    tests: {
      skip: true,
    }
  },
]

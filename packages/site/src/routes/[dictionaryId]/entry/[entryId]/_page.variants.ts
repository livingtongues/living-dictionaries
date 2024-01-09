import type { Variant } from 'kitbook';
import type Component from './+page.svelte';
import { readable, writable } from 'svelte/store';
import { logDbOperations } from '$lib/mocks/db';

const defaultProps = {
  locale: null,
  t: null,
  user: null,
  admin: readable(0),
  isManager: readable(false),
  isContributor: readable(false),
  canEdit: readable(false),
  algoliaQueryParams: writable(''),
  dictionary: writable({
    name: 'test',
    glossLanguages: [],
    alternateOrthographies: ['Alternate'],
  }),
  dbOperations: logDbOperations,
  supaEntry: null,
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
        isManager: readable(true),
        canEdit: readable(true),
        initialEntry: readable({
          lx: 'test',
        })
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
        canEdit: readable(true),
        initialEntry: readable({
          lx: 'test',
        })
      },
    },
    tests: {
      skip: true,
    }
  },
]

import type { Variant, Viewport } from 'kitbook'
import type Component from './PaginationButtons.svelte'

export const viewports: Viewport[] = [
  { width: 700, height: 100 },
  { width: 320, height: 100 },
]

export const languages= []

export const variants: Variant<Component>[] = [
  {
    name: 'First page',
    props: {
      current_page: 1,
      pages: 10,
    },
  },
  {
    name: 'Second page',
    props: {
      current_page: 2,
      pages: 30,
    },
  },
  {
    name: '1 page',
    props: {
      current_page: 1,
      pages: 1,
    },
  },
  {
    name: 'Middle of many',
    props: {
      current_page: 15,
      pages: 30,
    },
  },
  {
    name: 'Second to Last page',
    props: {
      current_page: 6,
      pages: 7,
    },
  },
  {
    name: 'Last page',
    props: {
      current_page: 7,
      pages: 7,
    },
  },
].map((variant) => ({
  ...variant,
  props: {
    ...variant.props,
    go_to_page: (page: number) => alert(`Go to page ${page}`),
  }
}))

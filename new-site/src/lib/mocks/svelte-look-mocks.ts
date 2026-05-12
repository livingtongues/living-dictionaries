import type { Flavor, MockedContext } from 'svelte-look'

export const default_page_data: Record<string, any> = {}

export const default_contexts: MockedContext[] = []

export const flavors: Record<string, Flavor> = {
  default: {
    page_data: {},
  },
}

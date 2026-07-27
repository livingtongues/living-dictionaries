import type { PageLoad } from './$types'

/** Every component schema — needs the full view, since slices prune to reachable ones. */
export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/v1/openapi.json?view=full')
  const spec = await response.json() as { components?: { schemas?: Record<string, any> } }
  return { schemas: Object.entries(spec.components?.schemas ?? {}) as [string, any][] }
}

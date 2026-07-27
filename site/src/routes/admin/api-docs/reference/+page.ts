import type { PageLoad } from './$types'

export interface SpecIndex {
  info?: { title?: string, version?: string, description?: string }
  tags?: { name: string, description?: string }[]
  paths?: Record<string, Record<string, { summary?: string, tags?: string[] }>>
  schema_names?: string[]
}

/**
 * The COMPACT INDEX — the default `openapi.json` view, i.e. exactly what an agent
 * gets when it first fetches the reference.
 */
export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/v1/openapi.json')
  const index = await response.json() as SpecIndex
  return { index }
}

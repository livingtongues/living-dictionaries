import type { PageLoad } from './$types'

/**
 * Fetch the live agent-facing OpenAPI spec so the admin page renders whatever
 * `/api/v1/openapi.json` currently serves — no copy of the data lives here.
 */
export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/v1/openapi.json')
  const spec = await response.json() as Record<string, any>
  return { spec }
}

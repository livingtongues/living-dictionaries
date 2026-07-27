import type { PageLoad } from './$types'
import type { FrontDoorDoc } from '$lib/api/v1/front-door'

/**
 * Fetch the LIVE front door with the same `Accept` an agent sends, so this page
 * renders exactly the document an agent receives — no second copy of the task
 * menu lives in the admin UI.
 */
export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/v1', { headers: { Accept: 'application/json' } })
  const front_door = await response.json() as FrontDoorDoc
  return { front_door }
}

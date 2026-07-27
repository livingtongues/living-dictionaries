import type { PageLoad } from './$types'
import { error } from '@sveltejs/kit'

/**
 * One tag slice — the exact `?tag=<name>` payload an agent fetches once it knows
 * which group it needs (paths + only the schemas they reach).
 */
export const load: PageLoad = async ({ fetch, params }) => {
  const response = await fetch(`/api/v1/openapi.json?tag=${encodeURIComponent(params.tag)}`)
  const spec = await response.json() as {
    tags?: { name: string, description?: string }[]
    paths?: Record<string, Record<string, any>>
    components?: { schemas?: Record<string, any> }
  }
  if (!spec.tags?.length)
    error(404, `No API group called "${params.tag}"`)

  const bytes = JSON.stringify(spec).length
  return { tag: spec.tags[0], spec, bytes }
}

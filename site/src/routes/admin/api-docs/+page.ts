import type { PageLoad } from './$types'

export interface GuideDoc {
  slug: string
  title: string
  description: string
  markdown: string
}

/**
 * Fetch the live agent-facing OpenAPI spec + the format-import guides so the
 * admin page renders whatever `/api/v1/openapi.json` and `/api/v1/guides`
 * currently serve — no copy of the data lives here.
 */
export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/v1/openapi.json')
  const spec = await response.json() as Record<string, any>

  let guides: GuideDoc[] = []
  try {
    const list_response = await fetch('/api/v1/guides')
    const { guides: listed } = await list_response.json() as { guides: { slug: string, title: string, description: string }[] }
    guides = await Promise.all(listed.map(async (guide) => {
      const markdown = await (await fetch(`/api/v1/guides/${guide.slug}`)).text()
      return { ...guide, markdown }
    }))
  } catch (err) {
    console.error('Failed to load guides', err)
  }

  return { spec, guides }
}

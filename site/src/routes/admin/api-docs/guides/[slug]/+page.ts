import type { PageLoad } from './$types'
import type { GuideListing } from '../+page'
import { error } from '@sveltejs/kit'

/**
 * One guide, fetched as the raw markdown an agent receives — plus the catalog so
 * the page can offer the neighbouring guides in reading order.
 */
export const load: PageLoad = async ({ fetch, params }) => {
  const [markdown_response, list_response] = await Promise.all([
    fetch(`/api/v1/guides/${params.slug}`),
    fetch('/api/v1/guides'),
  ])
  if (!markdown_response.ok)
    error(404, `No guide called "${params.slug}"`)

  const markdown = await markdown_response.text()
  const { guides } = await list_response.json() as { guides: GuideListing[] }
  const index = guides.findIndex(guide => guide.slug === params.slug)

  return {
    slug: params.slug,
    markdown,
    guide: guides[index],
    previous: index > 0 ? guides[index - 1] : null,
    next: index >= 0 && index < guides.length - 1 ? guides[index + 1] : null,
  }
}

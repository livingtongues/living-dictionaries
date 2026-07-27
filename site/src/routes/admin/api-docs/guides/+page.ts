import type { PageLoad } from './$types'

export interface GuideListing {
  slug: string
  title: string
  description: string
}

/** The live guide catalog — same call an agent makes to see what's available. */
export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/v1/guides')
  const { guides } = await response.json() as { guides: GuideListing[] }
  return { guides }
}

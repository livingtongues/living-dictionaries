/**
 * GET → the build-time homepage bake payload: platform stats + approved
 * featured word cards. Public (aggregate public data only). Fetched by
 * `site/scripts/fetch-homepage-baked.mjs` during the Docker image build
 * (same pattern as /api/i18n/export) and written to
 * `src/lib/data/homepage-baked.json`.
 */
import type { RequestHandler } from './$types'
import type { HomepageBaked } from '$lib/components/home-v2/types'
import { approved_featured_cards } from '$lib/db/server/featured-entries'
import { compute_homepage_stats } from '$lib/db/server/homepage-stats'
import { get_shared_db } from '$lib/db/server/shared-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export type HomepageExportResponseBody = HomepageBaked

export const GET: RequestHandler = () => {
  try {
    const shared_db = get_shared_db()
    return json({
      generated_at: new Date().toISOString(),
      stats: compute_homepage_stats({ shared_db }),
      featured_entries: approved_featured_cards({ db: shared_db }),
    } satisfies HomepageExportResponseBody)
  } catch (err) {
    console.error(`homepage export failed: ${(err as Error).message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `homepage export failed: ${(err as Error).message}`)
  }
}

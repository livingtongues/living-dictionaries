/**
 * Admin curation surface for the homepage word showcase.
 * GET → list featured_entries (optional ?status= filter).
 * POST → set status on one or more rows (approve / reject / back to suggested).
 * Rows are inserted by the curation agent (see .claude/commands/curate-featured-words.md).
 */
import type { RequestHandler } from './$types'
import type { FeaturedEntry, FeaturedEntryStatus } from '$lib/db/server/featured-entries'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { FEATURED_ENTRY_STATUSES, list_featured_entries, set_featured_entry_status } from '$lib/db/server/featured-entries'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error, json } from '@sveltejs/kit'

export interface AdminFeaturedEntriesResponseBody {
  featured_entries: FeaturedEntry[]
}

export interface AdminFeaturedEntriesRequestBody {
  ids: string[]
  status: FeaturedEntryStatus
}

export interface AdminFeaturedEntriesUpdateResponseBody {
  updated: number
}

async function require_admin(event: Parameters<RequestHandler>[0]) {
  const auth = await verify_auth(event)
  if (!is_admin(auth.email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')
}

export const GET: RequestHandler = async (event) => {
  await require_admin(event)
  const status = event.url.searchParams.get('status') as FeaturedEntryStatus | null
  if (status && !FEATURED_ENTRY_STATUSES.includes(status))
    error(ResponseCodes.BAD_REQUEST, `Unknown status: ${status}`)
  const featured_entries = list_featured_entries({ db: get_shared_db(), status: status ?? undefined })
  return json({ featured_entries } satisfies AdminFeaturedEntriesResponseBody)
}

export const POST: RequestHandler = async (event) => {
  await require_admin(event)
  const { ids, status } = await event.request.json() as AdminFeaturedEntriesRequestBody
  if (!Array.isArray(ids) || ids.length === 0 || ids.some(id => typeof id !== 'string'))
    error(ResponseCodes.BAD_REQUEST, 'ids must be a non-empty string array')
  if (!FEATURED_ENTRY_STATUSES.includes(status))
    error(ResponseCodes.BAD_REQUEST, `Unknown status: ${status}`)
  const updated = set_featured_entry_status({ db: get_shared_db(), ids, status })
  return json({ updated } satisfies AdminFeaturedEntriesUpdateResponseBody)
}

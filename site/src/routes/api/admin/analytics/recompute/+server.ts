/**
 * POST → fork the niced analytics child NOW, and answer immediately.
 *
 * The dashboards are a daily checkpoint (see `analytics-snapshot.ts`); this is the
 * "I want up-to-the-minute numbers" escape hatch behind the Recompute button — and
 * the only way an operator can cause an analytics compute at all. It still doesn't
 * happen in this process: the work is a `nice -n 19` child, and this handler
 * returns as soon as that child exists. The page re-fetches a minute later.
 *
 * Level-3 only. A compute is a couple of minutes of a 2-vCPU box's spare capacity,
 * so it's a founder-level lever, not a level-1 button.
 */
import type { RequestHandler } from './$types'
import type { SpawnOutcome } from '$lib/db/server/analytics-snapshot'
import { is_admin_at_least } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { spawn_analytics_snapshot_job } from '$lib/db/server/analytics-snapshot'
import { error, json } from '@sveltejs/kit'

export interface AdminAnalyticsRecomputeResponseBody {
  /** `spawned` | `already-running` | `ran-inline` (dev) | `failed`. */
  outcome: SpawnOutcome
}

export const POST: RequestHandler = async (event) => {
  const auth = await verify_auth(event)
  if (!is_admin_at_least(auth.email, 3))
    error(ResponseCodes.FORBIDDEN, 'Level-3 admin only')

  const outcome = await spawn_analytics_snapshot_job({ reason: 'manual' })
  return json({ outcome } satisfies AdminAnalyticsRecomputeResponseBody)
}

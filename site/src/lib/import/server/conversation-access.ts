/**
 * Route-level guards for the import-conversation endpoints. Kept out of
 * `$lib/db/server/import-conversations.ts` so that module stays a pure data
 * layer (and so we avoid an import cycle with `import-request-thread.ts`).
 */
import type { Database } from 'better-sqlite3'
import type { DictApiAccess } from '$lib/auth/verify-dict-api-access'
import type { ConversationRow } from '$lib/db/server/import-conversations'
import { ResponseCodes } from '$lib/constants'
import { get_conversation } from '$lib/db/server/import-conversations'
import { error } from '@sveltejs/kit'
import { is_site_admin_user } from './import-request-thread'

export function require_conversation({ db, dictionary_id, thread_id }: {
  db: Database
  dictionary_id: string
  thread_id: string | undefined
}): ConversationRow {
  const conversation = thread_id ? get_conversation({ db, dictionary_id, thread_id }) : null
  if (!conversation)
    error(ResponseCodes.NOT_FOUND, 'import conversation not found')
  return conversation
}

/**
 * Our side of the conversation: a site admin on a session, or any dict-scoped
 * API key (keys are inside the trust boundary and are how import agents act).
 */
export function is_team_actor({ db, access }: { db: Database, access: DictApiAccess }): boolean {
  return access.via === 'api_key' || is_site_admin_user({ db, user_id: access.user_id })
}

export function require_team({ db, access }: { db: Database, access: DictApiAccess }): void {
  if (!is_team_actor({ db, access }))
    error(ResponseCodes.FORBIDDEN, 'Only the Living Dictionaries team can do this')
}

/**
 * Which voice a message gets. An API key always speaks as the agent; a site
 * admin on a session as us; everyone else is the manager side.
 */
export function author_kind_for({ db, access }: { db: Database, access: DictApiAccess }): 'customer' | 'admin' | 'agent' {
  if (access.via === 'api_key')
    return 'agent'
  return is_site_admin_user({ db, user_id: access.user_id }) ? 'admin' : 'customer'
}

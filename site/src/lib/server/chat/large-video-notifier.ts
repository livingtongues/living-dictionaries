import type Database from 'better-sqlite3'
import type { DictionaryRow } from '$lib/db/server/get-dictionary'
import type { MediaCellKey } from '$lib/db/server/v1-media-write'
import { log_server_event } from '$lib/server/log-server-event'
import { format_large_video_notification } from './notification-messages'
import { post_system_notification } from './system-notifier'

function target_for({ db, cell_key, owner_id, dictionary_path }: {
  db: Database.Database
  cell_key: MediaCellKey
  owner_id: string
  dictionary_path: string
}): { label: 'entry' | 'sentence' | 'text', url_path: string } | null {
  if (cell_key === 'video:sense') {
    const sense = db.prepare('SELECT entry_id FROM senses WHERE id = ?').get(owner_id) as { entry_id: string } | undefined
    return sense ? { label: 'entry', url_path: `/${dictionary_path}/entry/${encodeURIComponent(sense.entry_id)}` } : null
  }
  if (cell_key === 'video:sentence')
    return { label: 'sentence', url_path: `/${dictionary_path}/sentence/${encodeURIComponent(owner_id)}` }
  if (cell_key === 'video:text')
    return { label: 'text', url_path: `/${dictionary_path}/text/${encodeURIComponent(owner_id)}` }
  return null
}

export function post_large_video_notification({ shared_db, dictionary, dict_db, cell_key, owner_id, media_id, size_bytes, actor_user_id, base_url }: {
  shared_db: Database.Database
  dictionary: DictionaryRow
  dict_db: Database.Database
  cell_key: MediaCellKey
  owner_id: string
  media_id: string
  size_bytes: number
  actor_user_id: string
  base_url: string
}): boolean {
  try {
    const dictionary_path = encodeURIComponent(dictionary.url || dictionary.id)
    const target = target_for({ db: dict_db, cell_key, owner_id, dictionary_path })
    if (!target)
      return false

    const actor_row = shared_db.prepare('SELECT name, email FROM users WHERE id = ?').get(actor_user_id) as { name: string | null, email: string | null } | undefined
    const actor = actor_row?.name || actor_row?.email || 'An API client'
    const actor_link_id = actor_row ? actor_user_id : null
    post_system_notification({
      db: shared_db,
      client_message_id: `large-video:${dictionary.id}:${media_id}`,
      content: format_large_video_notification({
        actor,
        actor_user_id: actor_link_id,
        dictionary_name: dictionary.name || dictionary.id,
        size_mib: (size_bytes / 1024 / 1024).toFixed(1),
        target_label: target.label,
        target_url: `${base_url}${target.url_path}`,
        base_url,
      }),
    })
    return true
  } catch (error) {
    log_server_event({ level: 'warn', message: 'large_video_notification_failed', error, context: { dictionary_id: dictionary.id, media_id } })
    return false
  }
}

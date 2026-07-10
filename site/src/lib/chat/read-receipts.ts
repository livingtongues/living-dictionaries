/**
 * Pure helpers for chat read receipts. The server hands us each member's
 * `last_read_at` (RoomReadPosition); these turn that into "which message is
 * each person parked on" (the moving read bubbles) and "who's caught up to the
 * newest message" (the text summary). ISO timestamps compare lexicographically
 * because they share one format.
 */
import type { RoomReadPosition } from '$lib/server/chat/chat-db'

interface BoundaryMessage {
  id: string
  created_at: string
  author_user_id: string
}

/**
 * For each OTHER member, the id of the newest message their `last_read_at`
 * reaches — that's where their bubble sits. Returns message_id → user_ids
 * (insertion order follows `read_positions`). Members with no read position,
 * or one older than the first message, get no bubble. `me_user_id` is excluded.
 */
export function compute_read_boundaries({ messages, read_positions, me_user_id }: {
  messages: readonly BoundaryMessage[]
  read_positions: readonly RoomReadPosition[]
  me_user_id: string
}): Map<string, string[]> {
  const boundaries = new Map<string, string[]>()
  if (!messages.length)
    return boundaries
  for (const position of read_positions) {
    if (position.user_id === me_user_id || !position.last_read_at)
      continue
    let boundary_id: string | null = null
    for (const message of messages) {
      if (message.created_at <= position.last_read_at)
        boundary_id = message.id
      else
        break
    }
    if (!boundary_id)
      continue
    const list = boundaries.get(boundary_id) ?? []
    list.push(position.user_id)
    boundaries.set(boundary_id, list)
  }
  return boundaries
}

/**
 * User ids (excluding me AND the last message's author) whose read position
 * reaches the newest message — powers the "Seen by …" / "Seen" summary line.
 */
export function caught_up_others({ messages, read_positions, me_user_id }: {
  messages: readonly BoundaryMessage[]
  read_positions: readonly RoomReadPosition[]
  me_user_id: string
}): string[] {
  if (!messages.length)
    return []
  const last = messages[messages.length - 1]
  return read_positions
    .filter(position =>
      position.user_id !== me_user_id
      && position.user_id !== last.author_user_id
      && !!position.last_read_at
      && position.last_read_at >= last.created_at)
    .map(position => position.user_id)
}

/**
 * Where the "new messages" divider sits when opening a room: the id of the
 * first message another member wrote after MY `last_read_at`, or null when
 * nothing is new (no divider). Compute it from the FIRST fetch after opening a
 * room — the server reads positions BEFORE marking the view as read, so my
 * position still reflects the previous visit — and freeze it until the room
 * changes. A member with no read position yet sees every other-authored
 * message as new.
 */
export function first_unread_message_id({ messages, read_positions, me_user_id }: {
  messages: readonly BoundaryMessage[]
  read_positions: readonly RoomReadPosition[]
  me_user_id: string
}): string | null {
  const my_last_read = read_positions.find(position => position.user_id === me_user_id)?.last_read_at ?? ''
  const first_unread = messages.find(message =>
    message.author_user_id !== me_user_id
    && message.created_at > my_last_read)
  return first_unread?.id ?? null
}

/** Up to two uppercase initials from a display name (falls back to '?'). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length)
    return '?'
  if (parts.length === 1)
    return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Deterministic, evenly-spread hue → a stable avatar color per user id. */
export function color_for_user(user_id: string): string {
  let hash = 0
  for (let i = 0; i < user_id.length; i++)
    hash = (hash * 31 + user_id.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return `hsl(${hue} 55% 45%)`
}

if (import.meta.vitest) {
  const messages: BoundaryMessage[] = [
    { id: 'm1', created_at: '2026-07-08T10:00:00.000Z', author_user_id: 'u-me' },
    { id: 'm2', created_at: '2026-07-08T10:05:00.000Z', author_user_id: 'u-a' },
    { id: 'm3', created_at: '2026-07-08T10:10:00.000Z', author_user_id: 'u-me' },
  ]

  describe(compute_read_boundaries, () => {
    it('parks each other member on the newest message they have reached', () => {
      const boundaries = compute_read_boundaries({
        messages,
        read_positions: [
          { user_id: 'u-me', last_read_at: '2026-07-08T10:10:00.000Z' },
          { user_id: 'u-a', last_read_at: '2026-07-08T10:06:00.000Z' }, // reached m2
          { user_id: 'u-b', last_read_at: '2026-07-08T10:10:00.000Z' }, // reached m3
        ],
        me_user_id: 'u-me',
      })
      expect(boundaries.get('m2')).toEqual(['u-a'])
      expect(boundaries.get('m3')).toEqual(['u-b'])
      expect(boundaries.has('m1')).toBe(false) // me is excluded
    })

    it('skips members with no read position or one before the first message', () => {
      const boundaries = compute_read_boundaries({
        messages,
        read_positions: [
          { user_id: 'u-a', last_read_at: null },
          { user_id: 'u-b', last_read_at: '2026-07-08T09:00:00.000Z' },
        ],
        me_user_id: 'u-me',
      })
      expect(boundaries.size).toBe(0)
    })
  })

  describe(caught_up_others, () => {
    it('lists others (not me, not the last author) who reached the newest message', () => {
      const result = caught_up_others({
        messages,
        read_positions: [
          { user_id: 'u-me', last_read_at: '2026-07-08T10:10:00.000Z' },
          { user_id: 'u-a', last_read_at: '2026-07-08T10:10:00.000Z' }, // caught up
          { user_id: 'u-b', last_read_at: '2026-07-08T10:06:00.000Z' }, // behind
        ],
        me_user_id: 'u-me',
      })
      expect(result).toEqual(['u-a'])
    })
  })

  describe(first_unread_message_id, () => {
    it('points at the first other-authored message after my last read', () => {
      const result = first_unread_message_id({
        messages,
        read_positions: [{ user_id: 'u-me', last_read_at: '2026-07-08T10:01:00.000Z' }],
        me_user_id: 'u-me',
      })
      expect(result).toBe('m2') // m3 is newer too, but m2 is where new starts
    })

    it('skips my own messages when finding the divider anchor', () => {
      const result = first_unread_message_id({
        messages,
        read_positions: [{ user_id: 'u-me', last_read_at: '2026-07-08T10:06:00.000Z' }],
        me_user_id: 'u-me',
      })
      expect(result).toBe(null) // only m3 is newer and it's mine
    })

    it('returns null when I am caught up', () => {
      const result = first_unread_message_id({
        messages,
        read_positions: [{ user_id: 'u-me', last_read_at: '2026-07-08T10:10:00.000Z' }],
        me_user_id: 'u-me',
      })
      expect(result).toBe(null)
    })

    it('treats everything by others as new when I have no read position', () => {
      const result = first_unread_message_id({
        messages,
        read_positions: [],
        me_user_id: 'u-me',
      })
      expect(result).toBe('m2') // m1 is mine
    })
  })

  describe(initials, () => {
    it('takes one or two initials', () => {
      expect(initials('Jacob Runner')).toBe('JR')
      expect(initials('Diego')).toBe('DI')
      expect(initials('   ')).toBe('?')
    })
  })

  describe(color_for_user, () => {
    it('is deterministic', () => {
      expect(color_for_user('u-a')).toBe(color_for_user('u-a'))
    })
  })
}

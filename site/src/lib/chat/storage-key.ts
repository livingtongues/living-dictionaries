import { CHAT_STORAGE_PREFIX } from './constants'

/**
 * Chat attachment object keys in the private attachments bucket:
 * `chat/{room_id}/{uuid}.{ext}`.
 *
 * The room id is IN the key on purpose. Presign and commit are two separate
 * requests, so commit has to decide whether the caller may turn an arbitrary
 * key into a `chat_attachments` row. Rather than persisting a pending-upload
 * table, commit re-derives the expected prefix from the message's room and
 * rejects anything outside it — combined with the random uuid (unguessable) and
 * a HeadObject existence check, a member can only commit an object they
 * themselves just presigned into their own room.
 *
 * Pre-existing rows (email attachments and pre-2026-07 chat uploads) are bare
 * uuids at the bucket root. Nothing re-derives their keys — serving always
 * reads `storage_key` off the row — so there is no migration.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Lowercased, dot-stripped, length-capped extension. Empty when there isn't a usable one. */
export function extension_from_filename(filename: string): string {
  const match = /\.([a-z0-9]{1,12})$/i.exec(filename.trim())
  return match ? match[1].toLowerCase() : ''
}

export function build_chat_storage_key({ room_id, upload_id, filename }: { room_id: string, upload_id: string, filename: string }): string {
  const extension = extension_from_filename(filename)
  return `${CHAT_STORAGE_PREFIX}/${room_id}/${upload_id}${extension ? `.${extension}` : ''}`
}

/**
 * True when `storage_key` is a well-formed chat key for exactly this room.
 * Rejects traversal, nested prefixes, and other rooms' keys.
 */
export function is_chat_storage_key_for_room({ storage_key, room_id }: { storage_key: string, room_id: string }): boolean {
  const segments = storage_key.split('/')
  if (segments.length !== 3)
    return false
  const [prefix, key_room_id, basename] = segments
  if (prefix !== CHAT_STORAGE_PREFIX || key_room_id !== room_id)
    return false
  const [upload_id, ...rest] = basename.split('.')
  if (rest.length > 1)
    return false
  if (rest.length === 1 && !/^[a-z0-9]{1,12}$/.test(rest[0]))
    return false
  return UUID_REGEX.test(upload_id)
}

if (import.meta.vitest) {
  describe(extension_from_filename, () => {
    it('extracts a lowercased extension', () => {
      expect(extension_from_filename('Recording.MP4')).toBe('mp4')
      expect(extension_from_filename('archive.tar.gz')).toBe('gz')
    })

    it('returns empty when there is no usable extension', () => {
      expect(extension_from_filename('README')).toBe('')
      expect(extension_from_filename('weird.extensionthatiswaytoolong')).toBe('')
      expect(extension_from_filename('trailing.')).toBe('')
    })
  })

  describe(build_chat_storage_key, () => {
    it('builds a room-scoped key', () => {
      expect(build_chat_storage_key({ room_id: 'diego-greg-jacob', upload_id: '11111111-2222-3333-4444-555555555555', filename: 'clip.mp4' }))
        .toBe('chat/diego-greg-jacob/11111111-2222-3333-4444-555555555555.mp4')
    })

    it('omits the extension when the filename has none', () => {
      expect(build_chat_storage_key({ room_id: 'r1', upload_id: '11111111-2222-3333-4444-555555555555', filename: 'LICENSE' }))
        .toBe('chat/r1/11111111-2222-3333-4444-555555555555')
    })
  })

  describe(is_chat_storage_key_for_room, () => {
    const room_id = 'diego-greg-jacob'
    const valid = 'chat/diego-greg-jacob/11111111-2222-3333-4444-555555555555.mp4'

    it('accepts a key it just built', () => {
      expect(is_chat_storage_key_for_room({ storage_key: valid, room_id })).toBe(true)
      expect(is_chat_storage_key_for_room({ storage_key: 'chat/diego-greg-jacob/11111111-2222-3333-4444-555555555555', room_id })).toBe(true)
    })

    it('rejects another room, another prefix, traversal, and non-uuid names', () => {
      expect(is_chat_storage_key_for_room({ storage_key: valid, room_id: 'other-room' })).toBe(false)
      expect(is_chat_storage_key_for_room({ storage_key: 'snapshots/diego-greg-jacob/11111111-2222-3333-4444-555555555555.mp4', room_id })).toBe(false)
      expect(is_chat_storage_key_for_room({ storage_key: 'chat/diego-greg-jacob/../../secret.mp4', room_id })).toBe(false)
      expect(is_chat_storage_key_for_room({ storage_key: 'chat/diego-greg-jacob/not-a-uuid.mp4', room_id })).toBe(false)
      expect(is_chat_storage_key_for_room({ storage_key: 'some-legacy-bare-uuid', room_id })).toBe(false)
    })
  })
}

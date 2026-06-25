/** Client-safe helpers for rendering chat attachments. */

/** Admin-authed serving URL for a chat attachment id. */
export function chat_attachment_url(id: string): string {
  return `/api/admin/chat/attachments/${id}`
}

export function is_image_mimetype(mimetype: string | null): boolean {
  return !!mimetype && mimetype.startsWith('image/')
}

const UNITS = ['B', 'KB', 'MB', 'GB']

export function format_bytes(size: number | null): string {
  if (!size)
    return ''
  let value = size
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`
}

if (import.meta.vitest) {
  describe(format_bytes, () => {
    it('formats common sizes', () => {
      expect(format_bytes(0)).toBe('')
      expect(format_bytes(512)).toBe('512 B')
      expect(format_bytes(1536)).toBe('1.5 KB')
      expect(format_bytes(20 * 1024 * 1024)).toBe('20 MB')
    })
  })

  describe(is_image_mimetype, () => {
    it('detects image types', () => {
      expect(is_image_mimetype('image/png')).toBe(true)
      expect(is_image_mimetype('application/pdf')).toBe(false)
      expect(is_image_mimetype(null)).toBe(false)
    })
  })
}

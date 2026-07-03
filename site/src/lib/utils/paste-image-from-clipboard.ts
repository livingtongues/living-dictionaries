/**
 * If the clipboard holds an image, prevent default paste and return it as a File.
 * Returns null when no image is present (text paste proceeds normally).
 */
export function paste_image_from_clipboard(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items
  if (!items)
    return null
  for (const item of items) {
    if (!item.type.startsWith('image/'))
      continue
    event.preventDefault()
    return item.getAsFile()
  }
  return null
}

if (import.meta.vitest) {
  describe(paste_image_from_clipboard, () => {
    it('returns null when clipboard has no image items', () => {
      const event = {
        clipboardData: {
          items: [{ type: 'text/plain', getAsFile: () => null }],
        },
        preventDefault: () => { /* no-op */ },
      } as unknown as ClipboardEvent
      expect(paste_image_from_clipboard(event)).toBeNull()
    })
  })
}

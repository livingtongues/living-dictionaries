/**
 * Every FILE on the clipboard, whatever its type (a copied video, a PDF, a
 * screenshot), preventing the default paste when there is at least one.
 *
 * Distinct from `paste_image_from_clipboard`, which stays image-only for the
 * EMAIL composers — outbound mail attachments are bounded by what SES will
 * accept, so those surfaces deliberately don't hoover up arbitrary files. Chat
 * uploads go straight to R2 and take anything.
 *
 * `clipboardData.items` also carries the plain-text/HTML flavours of a normal
 * text paste; those have `kind === 'string'` and are skipped, so pasting text
 * still behaves normally.
 */
export function paste_files_from_clipboard(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items
  if (!items)
    return []
  const files: File[] = []
  for (const item of items) {
    if (item.kind !== 'file')
      continue
    const file = item.getAsFile()
    if (file)
      files.push(file)
  }
  if (files.length)
    event.preventDefault()
  return files
}

if (import.meta.vitest) {
  function clipboard_event(items: { kind: string, type: string, file?: File }[]): { event: ClipboardEvent, prevented: () => boolean } {
    let default_prevented = false
    const event = {
      clipboardData: {
        items: items.map(item => ({ ...item, getAsFile: () => item.file ?? null })),
      },
      preventDefault: () => { default_prevented = true },
    } as unknown as ClipboardEvent
    return { event, prevented: () => default_prevented }
  }

  describe(paste_files_from_clipboard, () => {
    it('returns nothing and lets a text paste through', () => {
      const { event, prevented } = clipboard_event([{ kind: 'string', type: 'text/plain' }, { kind: 'string', type: 'text/html' }])
      expect(paste_files_from_clipboard(event)).toEqual([])
      expect(prevented()).toBe(false)
    })

    it('collects files of any type and prevents the default paste', () => {
      const video = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
      const pdf = new File(['y'], 'notes.pdf', { type: 'application/pdf' })
      const { event, prevented } = clipboard_event([
        { kind: 'string', type: 'text/plain' },
        { kind: 'file', type: 'video/mp4', file: video },
        { kind: 'file', type: 'application/pdf', file: pdf },
      ])
      expect(paste_files_from_clipboard(event)).toEqual([video, pdf])
      expect(prevented()).toBe(true)
    })
  })
}

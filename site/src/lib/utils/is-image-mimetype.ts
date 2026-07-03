export function is_image_mimetype(mimetype: string | null | undefined): boolean {
  return !!mimetype && mimetype.startsWith('image/')
}

if (import.meta.vitest) {
  describe(is_image_mimetype, () => {
    it('detects image types', () => {
      expect(is_image_mimetype('image/png')).toBe(true)
      expect(is_image_mimetype('application/pdf')).toBe(false)
      expect(is_image_mimetype(null)).toBe(false)
    })
  })
}

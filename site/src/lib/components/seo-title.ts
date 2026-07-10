const SITE_NAME = 'Living Dictionaries'

export function seoTitle({ title, dictionaryName, admin }: { title: string, dictionaryName?: string, admin?: number | boolean }) {
  if (!title) return dictionaryName || SITE_NAME // dict home: just "X Living Dictionary"
  if (!dictionaryName && title === SITE_NAME) return SITE_NAME // homepage: avoid "Living Dictionaries | Living Dictionaries"
  if (!dictionaryName) return `${title} | ${SITE_NAME}`
  if (admin) return `${dictionaryName} | ${title}`
  return `${title} | ${dictionaryName}`
}

if (import.meta.vitest) {
  test('seoTitle', () => {
    expect(seoTitle({ title: undefined })).toBe('Living Dictionaries')
    expect(seoTitle({ title: undefined, dictionaryName: 'Achi Living Dictionary' })).toBe('Achi Living Dictionary')
    expect(seoTitle({ title: 'About' })).toBe('About | Living Dictionaries')
    expect(seoTitle({ title: 'Living Dictionaries' })).toBe('Living Dictionaries')
    expect(seoTitle({ title: 'Entries', dictionaryName: 'Achi' })).toBe('Entries | Achi')
    expect(seoTitle({ title: 'Entries', dictionaryName: 'Achi', admin: true })).toBe('Achi | Entries')
  })
}

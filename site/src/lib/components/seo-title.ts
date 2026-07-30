const SITE_NAME = 'Living Dictionaries'

export function seo_title({ title, dictionary_name, admin }: { title: string, dictionary_name?: string, admin?: number | boolean }) {
  if (!title) return dictionary_name || SITE_NAME // dict home: just "X Living Dictionary"
  if (!dictionary_name && title === SITE_NAME) return SITE_NAME // homepage: avoid "Living Dictionaries | Living Dictionaries"
  if (!dictionary_name) return `${title} | ${SITE_NAME}`
  if (admin) return `${dictionary_name} | ${title}`
  return `${title} | ${dictionary_name}`
}

if (import.meta.vitest) {
  test('seo_title', () => {
    expect(seo_title({ title: undefined })).toBe('Living Dictionaries')
    expect(seo_title({ title: undefined, dictionary_name: 'Achi Living Dictionary' })).toBe('Achi Living Dictionary')
    expect(seo_title({ title: 'About' })).toBe('About | Living Dictionaries')
    expect(seo_title({ title: 'Living Dictionaries' })).toBe('Living Dictionaries')
    expect(seo_title({ title: 'Entries', dictionary_name: 'Achi' })).toBe('Entries | Achi')
    expect(seo_title({ title: 'Entries', dictionary_name: 'Achi', admin: true })).toBe('Achi | Entries')
  })
}

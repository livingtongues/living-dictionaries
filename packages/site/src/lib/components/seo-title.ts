const SITE_NAME = 'Living Dictionaries';

export function seoTitle({ title, dictionaryName, admin }: { title: string, dictionaryName?: string, admin?: number | boolean }) {
  if (dictionaryName) {
    if (admin) return `${dictionaryName} | ${title}`;

    return `${title} | ${dictionaryName}`
  }

  if (title) {
    return `${title} | ${SITE_NAME}`;
  }

  return SITE_NAME
}

if (import.meta.vitest) {
  test('seoTitle', () => {
    expect(seoTitle({ title: undefined })).toMatchInlineSnapshot('"Living Dictionaries"');
    expect(seoTitle({ title: 'About' })).toMatchInlineSnapshot('"About | Living Dictionaries"');
    expect(seoTitle({ title: 'Entries', dictionaryName: 'Achi' })).toMatchInlineSnapshot('"Entries | Achi"');
    expect(seoTitle({ title: 'Entries', dictionaryName: 'Achi', admin: true })).toMatchInlineSnapshot('"Achi | Entries"');
  });
}
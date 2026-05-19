import type { DeepPartial, EntryData } from '@living-dictionaries/types'

export function friendlyName(entry: DeepPartial<EntryData>, path: string) {
  if (path) {
    let fileTypeSuffix = path.split('.').pop()
    const index = fileTypeSuffix.indexOf('?')
    fileTypeSuffix = index === -1 ? fileTypeSuffix : fileTypeSuffix.substring(0, index)
    let gloss = entry.senses?.[0].glosses
      ? Object.values(entry.senses?.[0].glosses)[0]
      || Object.values(entry.senses?.[0].glosses)[1]
      || ''
      : ''
    gloss = gloss.replace(/\s+/g, '_').replace(/\W+/g, '')
    // non-ASCII characters: /[^\x20-\x7E]/g

    return `${entry.id}_${gloss}.${fileTypeSuffix}`
  }
  return ''
}

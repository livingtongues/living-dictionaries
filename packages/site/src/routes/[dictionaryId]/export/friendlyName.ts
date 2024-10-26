import type { EntryView } from '@living-dictionaries/types'
import type { DeepPartial } from 'kitbook'

export function friendlyName(entry: DeepPartial<EntryView>, path: string) {
  if (path) {
    const fileTypeSuffix = path.split('.').pop()
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

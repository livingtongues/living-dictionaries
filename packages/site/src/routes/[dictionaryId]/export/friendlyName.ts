import type { ExpandedEntry } from '@living-dictionaries/types';

export function friendlyName(entry: Partial<ExpandedEntry>, path: string) {
  if (path) {
    const fileTypeSuffix = path.split('.').pop();
    let gloss = entry.senses?.[0].glosses
      ? Object.values(entry.senses?.[0].glosses)[0] ||
        Object.values(entry.senses?.[0].glosses)[1] ||
        ''
      : '';
    gloss = gloss.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]+/g, '');
    // non-ASCII characters: /[^\x20-\x7E]/g

    return `${entry.id}_${gloss}.${fileTypeSuffix}`;
  }
  return '';
}

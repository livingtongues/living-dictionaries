import type { IEntry } from '@living-dictionaries/types';

export function friendlyName(entry: Partial<IEntry>, path: string) {
  const fileTypeSuffix = path.split('.').pop();
  let gloss = entry.gl ? Object.values(entry.gl)[0] || Object.values(entry.gl)[1] || '' : '';
  gloss = gloss.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]+/g, '');
  // non-ASCII characters: /[^\x20-\x7E]/g

  return `${entry.id}_${gloss}.${fileTypeSuffix}`;
}

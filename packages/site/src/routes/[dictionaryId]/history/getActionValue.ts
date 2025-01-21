import type { Tables } from '@living-dictionaries/types'

export function getActionValue(record: Tables<'content_updates'>): 'created' | 'edited' | 'deleted' {
  console.info(record)
  // if (record.previousValue?.length === 0)
  //   return 'created'
  // else if (record.currentValue?.length === 0)
  //   return 'deleted'

  return 'edited'
}

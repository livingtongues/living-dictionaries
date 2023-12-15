import type { Change } from '@living-dictionaries/types';

export function getActionValue(record: Change): 'created' | 'edited' | 'deleted' {
  if (record.previousValue?.length === 0)
    return 'created';
  else if (record.currentValue?.length === 0)
    return 'deleted';

  return 'edited';
}

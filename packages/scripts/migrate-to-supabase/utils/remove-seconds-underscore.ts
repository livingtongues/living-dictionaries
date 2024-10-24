import type { ActualDatabaseEntry } from '@living-dictionaries/types/entry.interface'

export function remove_seconds_underscore(entry: ActualDatabaseEntry & Record<string, any>) {
  // @ts-expect-error
  if (entry.updatedAt?._seconds) {
    // @ts-expect-error
    entry.updatedAt = {
      // @ts-expect-error
      seconds: entry.updatedAt._seconds,
    }
  }
  // @ts-expect-error
  if (entry.createdAt?._seconds) {
    // @ts-expect-error
    entry.createdAt = {
      // @ts-expect-error
      seconds: entry.createdAt._seconds,
    }
  }
  // @ts-expect-error
  if (entry.ua?._seconds) {
    // @ts-expect-error
    entry.ua = {
      // @ts-expect-error
      seconds: entry.ua._seconds,
    }
  }
  // @ts-expect-error
  if (entry.ca?._seconds) {
    // @ts-expect-error
    entry.ca = {
      // @ts-expect-error
      seconds: entry.ca._seconds,
    }
  }
  return entry
}

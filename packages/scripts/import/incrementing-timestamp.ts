const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
let milliseconds_to_add = 0

export function millisecond_incrementing_timestamp(): string {
  milliseconds_to_add += 1
  return new Date(yesterday.getTime() + milliseconds_to_add).toISOString()
}

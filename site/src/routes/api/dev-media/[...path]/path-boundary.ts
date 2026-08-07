export function path_is_within_root({ root, full, separator }: {
  root: string
  full: string
  separator: string
}): boolean {
  return full === root || full.startsWith(`${root}${separator}`)
}

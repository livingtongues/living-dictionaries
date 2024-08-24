const logged = new Set<string>()

export function log_once(msg: string) {
  if (logged.has(msg))
    return
  console.info(msg)
  logged.add(msg)
}

export function bind_events({ emitter, handlers }: { emitter: any, handlers: Record<string, any> }) {
  const unbindings = []

  for (const [handler, fn] of Object.entries(handlers)) {
    emitter.on(handler, fn)
    unbindings.push([handler, fn])
  }

  return () => {
    for (const [handler, fn] of unbindings)
      emitter.off(handler, fn)
  }
}

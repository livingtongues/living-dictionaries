export function bindEvents(el, handlers) {
  const unbindings = [];

  for (const [handler, fn] of Object.entries(handlers)) {
    el.on(handler, fn);
    unbindings.push([handler, fn]);
  }

  return () => {
    for (const [handler, fn] of unbindings) {
      el.off(handler, fn);
    }
  };
}

const VARIABLE_PLACEHOLDER = /{(w+)}/g

export function interpolate(template: string, values?: Record<string, string>) {
  if (!values)
    return template
  return template.replace(VARIABLE_PLACEHOLDER, (match, key) => values[key] || match)
}

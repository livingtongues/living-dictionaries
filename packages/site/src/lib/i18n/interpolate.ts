const VARIABLE_PLACEHOLDER = /{(?<key>\w+)}/g

export function interpolate(template: string, values?: Record<string, string>) {
  if (!values)
    return template
  return template.replace(VARIABLE_PLACEHOLDER, (match, key) => values[key] || match)
}

if (import.meta.vitest) {
  describe(interpolate, () => {
    test('replaces placeholders with corresponding values', () => {
      const template = 'Hi {name}, welcome to {site}!'
      const values = { name: 'Alice', site: 'Stack Overflow' }
      expect(interpolate(template, values)).toEqual('Hi Alice, welcome to Stack Overflow!')
    })

    test('leaves placeholders intact if not found in values', () => {
      const template = 'Hello {name}, your order is {orderNumber}.'
      const values = { name: 'Bob' }
      expect(interpolate(template, values)).toEqual('Hello Bob, your order is {orderNumber}.')
    })

    test('returns the original string if values are empty', () => {
      const template = 'Greetings {user}!'
      const values = {}
      expect(interpolate(template, values)).toEqual('Greetings {user}!')
      expect(interpolate(template)).toEqual('Greetings {user}!')
    })

    test('returns the original string if there are no placeholders', () => {
      const template = 'Just a regular string.'
      expect(interpolate(template)).toEqual('Just a regular string.')
    })
  })
}

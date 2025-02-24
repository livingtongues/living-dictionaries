export function set_cookie(name: string, value: string, options: CookieOptions = {}) {
  document.cookie = format_cookie(name, value, options)
}

interface CookieOptions {
  domain?: string
  expires?: string | Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: 'strict' | 'lax' | 'none'
  secure?: boolean
}

function format_cookie(name: string, value: string, options: CookieOptions = {}) {
  if (options.expires instanceof Date)
    options.expires = options.expires.toUTCString()

  const updatedCookie = {
    [encodeURIComponent(name)]: encodeURIComponent(value),
    sameSite: 'strict',
    path: '/',
    ...options,
  }

  const cookie = Object.entries(updatedCookie)
    .filter(([key]) => key !== 'secure')
    .map(kv => kv.join('='))
    .join(';')

  return options.secure === false ? cookie : `${cookie};secure`
}

if (import.meta.vitest) {
  describe(set_cookie, () => {
    test('basic, secure by default, root path by default', () => {
      const cookie = format_cookie('my-cookie', '123')
      expect(cookie).toEqual('my-cookie=123;sameSite=strict;path=/;secure')
    })

    test('handles options', () => {
      const cookie = format_cookie('my-cookie', '123', { maxAge: 1234, path: '/foo', sameSite: 'lax' })
      expect(cookie).toEqual('my-cookie=123;sameSite=lax;path=/foo;maxAge=1234;secure')
    })

    test('secure false', () => {
      const cookie = format_cookie('my-cookie', '123', { secure: false })
      expect(cookie).toEqual('my-cookie=123;sameSite=strict;path=/')
    })

    test('clear cookie', () => {
      const cookie = format_cookie('my-cookie', '', { expires: new Date(0) })
      expect(cookie).toEqual('my-cookie=;sameSite=strict;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT;secure')
    })
  })
}

const urlRegex = /(((https?:\/\/)|(www\.))[^\s>]+\w\/?)/g

export function prepareDisplay(s: string) {
  if (urlRegex.test(s)) {
    return s.replace(/https?:\/\//, '')
  }
  return s
}

export function prepareHref(s: string) {
  const match = s?.match(urlRegex)
  if (match?.length) {
    return match[0].replace(/^www\./, 'http://')
  }
  return null
}

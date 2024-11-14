const regexForRichText = /<\w+>|<\/\w+>|<\w+ [a-z:\-/.]+=['"][a-z:\-/.]+(;*)['"]>|&nbsp;/g

export function stripHTMLTags(text: string): string {
  if (!text) return ''
  return text
    .replace(regexForRichText, ' ')
    .trim()
    .split(/\s+/)
    .join(' ')
}

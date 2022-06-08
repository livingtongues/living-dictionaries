const regexForRichText = /<\w+>|<\/\w+>|<\w+ [a-z:\-/.]+=['"][a-z:\-/.]+(;*)['"]>|&nbsp;/g;

export function replaceHTMLTags(text: string): string {
  return text
    .replace(regexForRichText, ' ')
    .trim()
    .split(/[\s,\t,\n]+/)
    .join(' ');
}

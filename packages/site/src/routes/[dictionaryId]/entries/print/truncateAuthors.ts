const maxLengthLookingGoodInLetter = 43
const firstCommaAndTypeOfDividerRgx = /(,|and|&)/

export function truncateAuthors(authors: string): string {
  if (!authors) return ''
  if (authors.length < maxLengthLookingGoodInLetter) return `${authors.trim().replace(/,$/, '')}, `

  const [truncatedFirstAuthor] = authors.split(firstCommaAndTypeOfDividerRgx)
  return addEtAlEnding(truncatedFirstAuthor)
}

function addEtAlEnding(authors: string): string {
  return `${authors.trim().replace(/,$/, '')}, et al., `
}

const splitFirstAuthorRgx = /(,|and|&)/g;

export function truncateAuthors(authorString: string): string {
  if (!authorString) return '';

  const maxLengthLookingGoodInLetter = 43;
  if (authorString.length > maxLengthLookingGoodInLetter) {
    const truncatedFirstAuthor = authorString.split(splitFirstAuthorRgx)[0];
    return addEtAlEnding(truncatedFirstAuthor);
  }
  return authorString + ', ';
}

function addEtAlEnding(authors: string): string {
  return authors.trim().replace(/,$/, '') + ', et al., ';
}

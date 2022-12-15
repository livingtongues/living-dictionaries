const splitAuthorsRgx = /(?=,|and|&)/g;

export function truncateAuthors(authorString: string): string {
  if (!authorString) return '';

  const maxLengthLookingGoodInLetter = 43;
  if (authorString.length > maxLengthLookingGoodInLetter) {
    let truncatedAuthors = '';
    const authors = authorString.split(splitAuthorsRgx);
    for (const author of authors) {
      if (truncatedAuthors.length + author.length > maxLengthLookingGoodInLetter) {
        truncatedAuthors = addEtAlEnding(truncatedAuthors);
        break;
      }
      truncatedAuthors += author;
    }
    return truncatedAuthors;
  }
  return authorString + ', ';
}

function addEtAlEnding(authors: string): string {
  return authors.trim().replace(/,$/, '') + ', et al., ';
}
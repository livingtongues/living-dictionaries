/**
 * @returns {import('svelte/types/compiler/preprocess').PreprocessorGroup}
 * @param {string} partOfFilename Portion of filename to log
 */
export default (partOfFilename) => {
  return {
    markup({ content, filename }) {
      if (filename.includes(partOfFilename)) {
        console.log(`${filename}`);
        console.log(content);
      }
      return { code: content };
    }
  }
}
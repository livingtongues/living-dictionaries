import { partsOfSpeech } from '@living-dictionaries/parts';

/**
 * Convert old Living Dictionary fields to match CSV template fields in preparation for data processing and upload to Firestore
 */
export const convertOldTDKeyNames = (tdData: any[]) => {
  identifyUnmatchedPOS(tdData);
  let entryCount = 0;
  let audioRefCount = 0;
  let imageRefCount = 0;

  for (const tdEntry of tdData) {
    ++entryCount;
    // Always set lexeme even if blank string
    tdEntry.lexeme = tdEntry.lang.replace(/&#8217;/g, '\''); // handle old TD apostrophes correctly
    delete tdEntry.lang;

    // if these fields are blank, delete, otherwise leave alone as they're named correct
    if (!tdEntry.es_gloss)
      delete tdEntry.es_gloss;

    if (!tdEntry.authority)
      delete tdEntry.authority;

    if (!tdEntry.dialect)
      delete tdEntry.dialect;


    // Set proper fields if they exist, delete old fields
    if (tdEntry.gloss)
      tdEntry.en_gloss = tdEntry.gloss;

    delete tdEntry.gloss;

    if (tdEntry.ipa)
      tdEntry.phonetic = tdEntry.ipa.replace(/&#8217;/g, '\''); // handle old TD apostrophes correctly

    delete tdEntry.ipa;

    if (tdEntry.pos) {
      const { value, matched } = abbreviateTDPartOfSpeech(tdEntry.pos);
      if (matched)
        tdEntry.partOfSpeech = value;
      else
        tdEntry.notes = value; // save misc parts of speech into the notes column if they don't match up with our standard POS list

    }
    delete tdEntry.pos;

    if (tdEntry.usage_example)
      tdEntry.vernacular_exampleSentence = tdEntry.usage_example;

    delete tdEntry.usage_example;

    if (tdEntry.metadata) {
      if (tdEntry.notes)
        tdEntry.notes = tdEntry.notes + ', ' + tdEntry.metadata;
      else
        tdEntry.notes = tdEntry.metadata;

    }
    delete tdEntry.metadata;

    if (tdEntry.audio) {
      ++audioRefCount;
      tdEntry.soundFile = tdEntry.audio;
    }
    delete tdEntry.audio;

    if (tdEntry.image) {
      ++imageRefCount;
      tdEntry.photoFile = tdEntry.image;
    }
    delete tdEntry.image;

    if (tdEntry.semantic_ids)
      tdEntry.semanticDomain_custom = tdEntry.semantic_ids;

    delete tdEntry.semantic_ids;
  }
  console.log(
    `Converted ${entryCount} entries, and found ${audioRefCount} audio references, and ${imageRefCount} image references`
  );
  return tdData;
};

/**
 * Convert old Living Dictionary parts of speech (both English and Spanish) to English abbreviations
 */
export const abbreviateTDPartOfSpeech = (input: string) => {
  const sanitizedInput = input
    .trim()
    .toLowerCase()
    .replace(/[.]$/, '') // removes word-final periods
    .replace(/:/g, ''); // removes random colons in old TD data
  const matchingPOS = partsOfSpeech.find((part) => {
    //TODO, possibly more efficient just to return enAbbrev and not whole part object
    return (
      part.enName === sanitizedInput ||
      part.esName === sanitizedInput ||
      part.enAbbrev === sanitizedInput ||
      (part.tdAlternates?.includes(sanitizedInput))
    );
  });
  // console.log({sanitizedInput}, {matchingPOS});
  return (
    (matchingPOS && { value: matchingPOS.enAbbrev, matched: true }) || {
      value: sanitizedInput,
      matched: false,
    }
  );
};

/**
 * Logs unique parts and a warning if any unmatched parts found so we know which are being pushed to the notes field
 */
export const identifyUnmatchedPOS = (tdData: any[]) => {
  const uniquePartsOfSpeech: any = [];

  for (const tdEntry of tdData) {
    if (tdEntry.pos) {
      const {pos} = tdEntry;
      if (uniquePartsOfSpeech.indexOf(pos) === -1) uniquePartsOfSpeech.push(pos);
    }
  }
  uniquePartsOfSpeech.forEach((part: string) => {
    const { matched } = abbreviateTDPartOfSpeech(part);
    if (!matched)
      console.log('No abbreviation found for: ', part);

  });
};

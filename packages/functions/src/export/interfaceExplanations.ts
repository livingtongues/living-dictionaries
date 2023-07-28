export const entryInterface = {
  id:
    'Unique Entry ID - use this for links to the entry on Living Dictionaries, as well as to compare new imports with previous data',
  lx:
    'lexeme is the linguistic term meaning the \'headword\' for the dictionary entry - this is the word or phrase in the vernacular language which is being described by all of the other data, being photographed, and recorded',
  gl: {
    en:
      'English gloss - the word/phrase used in English that is a translation of the lexeme into English',
    es:
      'Multiple keys can show up in the gloss object - one for each language which the lexemes in this dictionary are being made available in. So for a dictionary that makes words understandable to English and Spanish speakers, you would see a gloss object with \'en\' and \'es\' keys (keys are the bcp codes for languages)',
  },
  in: 'interlinearization',
  lo:
    'Local/Alternate Orthography - some languages have two writings systems or more, and these fields give opportunity for expressing these alternate writing systems - Look at the optional dictionary.alternateOrthographies object to learn the name of each orthography',
  lo2: 'Local Orthography 2...',
  lo3: 'Local Orthography 3...',
  lo4: 'Local Orthography 4...',
  lo5: 'Local Orthography 5...',
  di: 'dialect',
  ph: 'phonetic pronunciation - usually written in IPA (international phonetic alphabet)',
  ps: 'part of speech abrreviation (see partOfSpeechMappings)',
  sdn: 'array of semantic domain number strings (see semanticDomainNumberMappings)',
  sd: 'semantic domain strings (deprecated)',
  nt: 'notes',
  xv: 'example vernacular',
  xs:
    'example sentences object formatted in same manner as gl object, except the \'vn\' key refers to the vernacular language',
  mr: 'morphology (of the lexeme)',
  sf: {
    speakerName: 'name of speaker in recorded sound file',
    sp: 'id speaker in recorded sound file',
    ts: 'timestamp of recording',
    audioURL: 'Audio file location',
  },
  pf: {
    imageURL: 'Image file location',
  },
  ca: 'created at',
  ua: 'updated at',
  ei: 'Elicitation Id',
};

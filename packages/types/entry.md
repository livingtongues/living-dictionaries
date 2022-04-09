# Entry Data Structure

**lx: string; // lexeme**

## Writing

- ph?: string; // international phonetic alphabet transcription
- lo?: string; // Local Orthography
- lo2?: string; // Local Orthography 2
- lo3?: string; // Local Orthography 3
- lo4?: string; // Local Orthography 4
- lo5?: string; // Local Orthography 5

## Meaning & Morphology

- gl: // glosses
  - { [bcp47Code: string]: string }
- in?: string; // interlinearization
- mr?: string; // morphology
- ps?: string; // part of speech
- sd?: string[]; // semantic domain string(s), used for custom semantic domains brought in from imports
- sdn?: string[]; // semantic domain number(s), simplified system modeled after SemDom (eg. 2.1.2.3)

## Language & entry metadata

- di?: string; // dialect for this entry
- nt?: string; // notes
- sr?: string[] // Source(s)

## Example Usage & Media

- xs?: // example sentences
  - vn?: string; // vernacular,
  - [bcp47Code: string]: string; // example sentences in glossing languages
- sf?: // sound file
  - path: string;
  - ts?: any; // timestamp
  - ab?: string; // added by userId
  - sp?: string; // id of speaker
  - sc?: string; // source
- pf?: // photo file
  - path: string;
  - ts?: any; // timestamp
  - ab?: string; // added by userId
  - sc?: string; // source

## IDs

- ii?: string; // importId which can be used to show all entries from a particular import
- ei?: string; // Elicitation Id (can be used customly by each dictionary based on its needs)

## Notes

- This is a human friendly and simplified version of the Typescript interface for the data stored in a NoSQL database
- Fields will be added or refactored as opportunity allows

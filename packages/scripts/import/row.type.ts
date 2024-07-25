import type { Glossing_Languages } from '@living-dictionaries/site/src/lib/glosses/glossing-languages'

export type Row = {
  [key in (Entry | Sense | Sentence | Media)]?: string;
}
// 's3.es_gloss': 'hi',
// 'semanticDomain4': '2.3',
// 's2.fr_exampleSentence.3': 'Bonjour docteur',
// 's4.default_vernacular_exampleSentence': 'foo bar',

type Sense_Prefix = '' | 's2.' | 's3.' | 's4.' | 's5.' | 's6.' | 's7.' | 's8.' | 's9.'
type Number_Suffix = '' | '.2' | '.3' | '.4' | '.5' | '.6' | '.7' | '.8' | '.9'

type Entry = 'lexeme' | `localOrthography${Number_Suffix}` | 'phonetic' | 'dialects' | 'ID' | 'notes' | 'source' | 'morphology' | 'interlinearization' | 'scientificName' | 'pluralForm' | 'variant'

type Sense = `${Sense_Prefix}${Sense_Fields}`
type Sense_Fields = `${Glossing_Languages}_gloss` | `partOfSpeech${Number_Suffix}` | `semanticDomain${Number_Suffix}` | 'semanticDomain_custom' | 'nounClass' // en_gloss, s2.en_gloss, nounClass, s2.nounClass

type Sentence = `${Sense_Prefix}${Sentence_Fields}` | `${Sense_Prefix}${Sentence_Fields}${Number_Suffix}`
type Sentence_Fields = `${Glossing_Languages}_exampleSentence` | `${Writing_Systems}_vernacular_exampleSentence` | 'vernacular_exampleSentence'

type Media = 'photoFile' | 'soundFile' | 'speakerName' | 'speakerHometown' | 'speakerAge' | 'speakerGender'

// type Writing_Systems = 'default' // TODO improve Writing Systems field

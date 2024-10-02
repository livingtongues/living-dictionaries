import type { Tables } from './combined.types'

export type SenseWithSentences = (Pick<Tables<'senses'>, 'id' | 'glosses' | 'parts_of_speech' | 'semantic_domains' | 'write_in_semantic_domains' | 'noun_class' | 'definition' | 'plural_form' | 'variant'> & { sentences: Pick<Tables<'sentences'>, 'id' | 'text' | 'translation'>[] })

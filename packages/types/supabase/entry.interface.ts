import type { IGloss } from '../gloss.interface'

export interface SupaEntry {
  senses: SupaSense[];
}

export interface SupaSense {
  id: string;
  glosses?: IGloss;
  parts_of_speech?: string[];
  semantic_domains?: string[];
  write_in_semantic_domains?: string[];
  noun_class?: string;
  definition_english_deprecated?: string;
  // example_sentences?: IExampleSentence[]; // junction table
  // photo_files?: ExpandedPhoto[]; // junction table
  // video_files?: ExpandedVideo[]; // junction table
}

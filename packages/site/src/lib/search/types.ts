export interface QueryParams {
  page: number;
  query: string;
  // part_of_speech_filters?: string[]; // might need to be called facets
  // semantic_domain_filters?: string[];
  // dialect_filters?: string[];
  // speaker_filters?: string[];
  has_audio?: boolean;
  no_audio?: boolean;
  has_image?: boolean;
  no_image?: boolean;
  has_video?: boolean;
  no_video?: boolean;
  // has_speaker?: boolean;
  // no_speaker?: boolean;
  // has_sentence?: boolean;
  // has_noun_class?: boolean;
  // has_plural_form?: boolean;
  // has_part_of_speech?: boolean;
  // has_semantic_domain?: boolean;
}

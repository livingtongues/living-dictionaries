// import { createQueryParamStore } from 'svelte-pieces';
import { createQueryParamStore } from './query-param-store';

export interface SearchParams {
  page: number;
  query: string;
  part_of_speech_filters?: string[]; // might need to be called facets
  semantic_domain_filters?: string[];
  dialect_filters?: string[];
  speaker_filters?: string[];
  has_image?: 'yes' | 'no';
  has_audio?: 'yes' | 'no';
  has_video?: 'yes' | 'no';
  has_speaker?: 'yes' | 'no';
  has_sentence?: 'yes' | 'no';
  has_noun_class?: 'yes' | 'no';
  has_plural_form?: 'yes' | 'no';
  has_part_of_speech?: 'yes' | 'no';
  has_semantic_domain?: 'yes' | 'no';
}

export const load = ({params: {dictionaryId}}) => {
  const default_search_params: SearchParams = {
    page: 1,
    query: '',
    // has_audio: 'yes',
  }
  const search_params = createQueryParamStore({
    key: 'qu',
    startWith: default_search_params,
    persist: 'sessionStorage',
    storagePrefix: dictionaryId + '_',
    log: true
  })

  return { search_params }
}

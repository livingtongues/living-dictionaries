import type { TranslateFunction } from '$lib/i18n/types';

export function translate_part_of_speech_to_current_language(part_of_speech_abbrev: string, t: TranslateFunction): string {
  return t({ dynamicKey: `ps.${part_of_speech_abbrev}`, fallback: part_of_speech_abbrev });
}

export function translate_semantic_domain_keys_to_current_language(semantic_domain_key: string, t: TranslateFunction): string {
  return t({ dynamicKey: `sd.${semantic_domain_key}`, fallback: semantic_domain_key });
}


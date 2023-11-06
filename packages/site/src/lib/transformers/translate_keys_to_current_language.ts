import type { TranslateFunction } from '$lib/i18n/types';

export function translate_part_of_speech_to_current_language(part_of_speech_abbrev: string, t: TranslateFunction): string {
  return t(`ps.${part_of_speech_abbrev}`, { fallback: part_of_speech_abbrev });
}

if (import.meta.vitest) {
  describe('translate_part_of_speech_to_current_language', () => {
    const part_of_speech_abbrev = 'n'

    test('English', () => {
      const english_value = 'noun';

      addMessages('en', { ps: { [part_of_speech_abbrev]: english_value } });

      expect(translate_part_of_speech_to_current_language(part_of_speech_abbrev)).toBe(english_value);
    });

    test('Spanish', () => {
      const spanish_value = 'sustantivo';

      addMessages('es', { ps: { [part_of_speech_abbrev]: spanish_value } });

      expect(translate_part_of_speech_to_current_language(part_of_speech_abbrev)).toBe(spanish_value);
    });

    test('part of speech not found in translations passes through', () => {
      addMessages('en', {});

      expect(translate_part_of_speech_to_current_language('intransitive-monkey')).toBe('intransitive-monkey');
    });
  });
}

export function translate_semantic_domain_keys_to_current_language(semantic_domain_key: string, t: TranslateFunction): string {
  return t(`sd.${semantic_domain_key}`, { default: semantic_domain_key });
}

if (import.meta.vitest) {
  describe('translate_semantic_domain_keys_to_current_language', () => {
    const sdn_key = '1.1';

    test('English', () => {
      const english_value = 'Sky, weather and climate';

      addMessages('en', { sd: { [sdn_key]: english_value } });

      expect(translate_semantic_domain_keys_to_current_language(sdn_key)).toBe(english_value);
    });

    test('Spanish', () => {
      const spanish_value = 'Cielo, tiempo y clima';

      addMessages('es', { sd: { [sdn_key]: spanish_value } });

      expect(translate_semantic_domain_keys_to_current_language(sdn_key)).toBe(spanish_value);
    });

    test('Semantic Domain Key not found in translations passes through', () => {
      addMessages('en', {});

      expect(translate_semantic_domain_keys_to_current_language('Foo')).toBe('Foo');
    });
  });
}

import { register, init, waitLocale, locale, dictionary, t } from 'svelte-i18n';
import { get } from 'svelte/store';

export function translate_part_of_speech_to_current_language(part_of_speech_abbrev: string): string {
  const $t = get(t);
  const part_of_speech = $t(`ps.${part_of_speech_abbrev}`, { default: part_of_speech_abbrev });
  return part_of_speech;
}

if (import.meta.vitest) {
  describe('translate_part_of_speech_to_current_language', () => {
    beforeEach(() => {
      dictionary.set({});
      locale.set(undefined);
    });

    const part_of_speech_abbrev = 'n'

    test('English', async () => {
      const english_value = 'noun';

      register('en', () => Promise.resolve({ ps: { [part_of_speech_abbrev]: english_value } }));
      init({ fallbackLocale: 'en', initialLocale: 'en' });
      await waitLocale('en');

      expect(translate_part_of_speech_to_current_language(part_of_speech_abbrev)).toBe(english_value);
    });

    test('Spanish', async () => {
      const spanish_value = 'sustantivo';

      register('es', () => Promise.resolve({ ps: { [part_of_speech_abbrev]: spanish_value } }));
      init({ fallbackLocale: 'es', initialLocale: 'es' });
      await waitLocale('es');

      expect(translate_part_of_speech_to_current_language(part_of_speech_abbrev)).toBe(spanish_value);
    });

    test('part of speech not found in translations passes through', async () => {
      register('en', () => Promise.resolve({}));
      init({ fallbackLocale: 'en', initialLocale: 'en', warnOnMissingMessages: false });
      await waitLocale('en');

      expect(translate_part_of_speech_to_current_language('intransitive-monkey')).toBe('intransitive-monkey');
    });
  });
}

export function translate_semantic_domain_keys_to_current_language(semantic_domain_key: string): string {
  const $t = get(t);
  const semantic_domain = $t(`sd.${semantic_domain_key}`, { default: semantic_domain_key });
  return semantic_domain;
}

if (import.meta.vitest) {
  describe('translate_semantic_domain_keys_to_current_language', () => {
    beforeEach(() => {
      dictionary.set({});
      locale.set(undefined);
    });

    const sdn_key = '1.1';

    test('English', async () => {
      const english_value = 'Sky, weather and climate';

      register('en', () => Promise.resolve({ sd: { [sdn_key]: english_value } }));
      init({ fallbackLocale: 'en', initialLocale: 'en' });
      await waitLocale('en');

      expect(translate_semantic_domain_keys_to_current_language(sdn_key)).toBe(english_value);
    });

    test('Spanish', async () => {
      const spanish_value = 'Cielo, tiempo y clima';

      register('es', () => Promise.resolve({ sd: { [sdn_key]: spanish_value } }));
      init({ fallbackLocale: 'es', initialLocale: 'es' });
      await waitLocale('es');

      expect(translate_semantic_domain_keys_to_current_language(sdn_key)).toBe(spanish_value);
    });

    test('Semantic Domain Key not found in translations passes through', async () => {
      register('en', () => Promise.resolve({}));
      init({ fallbackLocale: 'en', initialLocale: 'en', warnOnMissingMessages: false });
      await waitLocale('en');

      expect(translate_semantic_domain_keys_to_current_language('Foo')).toBe('Foo');
    });
  });
}

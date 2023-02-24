import { register, init, waitLocale, t, locale } from 'svelte-i18n';
import { get } from 'svelte/store';

async function init_i18n(bcp = 'en') {
  // register(bcp, () => import(`../../locales/ps/${bcp}.json`));
  // register(bcp, () => import(`../../locales/sd/${bcp}.json`));
  // register('en', () => import(`../../locales/ps/en.json`));
  register('en', () => import(`../../locales/sd/en.json`));
  // register('es', () => import(`../../locales/ps/es.json`));
  register('es', () => import(`../../locales/sd/es.json`));
  init({ fallbackLocale: 'en', initialLocale: bcp });
  return await waitLocale();
}

export function translate_part_of_speech_to_current_language(part_of_speech: string, bcp: string): string {
  // return part_of_speech;
  return 'noun';
}

describe('translate_part_of_speech_to_current_language', () => {
  test('basic', () => {
    const actual = 'n';
    const expected = 'noun';
    expect(translate_part_of_speech_to_current_language(actual, 'en')).toBe(expected);
  });
});


describe('translate_semantic_domain_keys_to_current_language', async () => {
  const sdn_key = '1.1';
  await init_i18n();

  test('English', () => {
    const english = 'Sky, weather and climate';
    locale.set('en');
    expect(translate_semantic_domain_keys_to_current_language(sdn_key)).toBe(english);
  });

  test.fails('Spanish', () => {
    const spanish = 'Cielo, tiempo y clima';
    locale.set('es');
    expect(translate_semantic_domain_keys_to_current_language(sdn_key)).toBe(spanish);
  });
});


function translate_semantic_domain_keys_to_current_language(semantic_domain_key: string): string {
  const $t = get(t);
  const semantic_domain = $t(`sd.${semantic_domain_key}`)
  return semantic_domain;
}

// entries with current database format are

// -> expanded into desired shape for site usage
// -> data that displays based on language (semantic domains, parts of speech) is converted into the current language

// entries are easily usable and uniform in shape

// <- to save an edit, change is condensed into current database format and saved

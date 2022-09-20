import { glossingLanguages } from '@living-dictionaries/parts';
import { _ } from 'svelte-i18n';
import { get } from 'svelte/store';

export function vernacularName(bcp: string) {
  if (glossingLanguages[bcp] && glossingLanguages[bcp].vernacularName) {
    return glossingLanguages[bcp].vernacularName;
  } else {
    const $_ = get(_);
    return `${$_('gl.' + bcp)}`;
  }
}

// if (import.meta.vitest) {
  // test('vernacularName should tranform "en" into "English" and "es" into "español", etc...', () => {
  //   expect(vernacularName('en')).toBe('English');
  //   expect(vernacularName('es')).toBe('español');
  //   expect(vernacularName('cmn')).toBe('中文');
  // });
  
  // test('englishName should tranform "en" into "English" and "es" into "Spanish", etc...', () => {
  //     expect(englishName('en')).toBe("English");
  //     expect(englishName('es')).toBe("Spanish");
  //     expect(englishName('cmn')).toBe("Mandarin");
  // })
// }
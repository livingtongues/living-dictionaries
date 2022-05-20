import { vernacularName } from './vernacularName';

test.skip('vernacularName should tranform "en" into "English" and "es" into "español", etc...', () => {
  expect(vernacularName('en')).toBe('English');
  expect(vernacularName('es')).toBe('español');
  expect(vernacularName('cmn')).toBe('中文');
});

// test('englishName should tranform "en" into "English" and "es" into "Spanish", etc...', () => {
//     expect(englishName('en')).toBe("English");
//     expect(englishName('es')).toBe("Spanish");
//     expect(englishName('cmn')).toBe("Mandarin");
// })

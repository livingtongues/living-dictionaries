import { clipCitation } from './clipCitation';

test('One author in citation', () =>
  expect(
    clipCitation(
      'Anderson G.',
      '2022. Test 004 Living Dictionary. Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/test-004'
    )
  ).toBe('Anderson G.'));

test('Two authors in citation but still below the max size', () =>
  expect(
    clipCitation(
      'Derwing, T. M. & Rossiter, M. J.',
      '2022. Test 004 Living Dictionary. Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/test-004'
    )
  ).toBe('Derwing, T. M. & Rossiter, M. J.'));

test('Authors in citation exceding max size', () =>
  expect(
    clipCitation(
      'Derwing T. Summo A. O. Davids M G. & Timmo E. R.',
      '2022. Test 004 Living Dictionary. Living Tongues Institute for Endangered Languages. https://livingdictionaries.app/test-004'
    )
  ).toBe('Derwing et al.,'));

import { clipCitation } from './clipCitation';

test('One author in citation', () =>
  expect(clipCitation('Anderson G.')).toBe('Anderson G.'));

test('One author in citation with apostrophe in her/his name', () =>
  expect(clipCitation("O'Neal S.")).toBe("O'Neal S."));

test('Two authors in citation but still below the max size', () =>
  expect(clipCitation('Derwing, T. M. & Rossiter, M. J.'))
    .toBe('Derwing, T. M. & Rossiter, M. J.'));

test('Authors in citation exceding max size', () =>
  expect(clipCitation('Derwing T. Summo A. O. Davids M G. & Timmo E. R.'))
    .toBe('Derwing T. et al.,'));

test('Authors in citation exceding max size and first author with accent', () =>
  expect(clipCitation('Córdova D. Summo A. O. Davids M G. & Timmo E. R.'))
    .toBe('Córdova D. et al.,'));

test('Handles undefined', () =>
  expect(clipCitation(undefined)).toBe(''));
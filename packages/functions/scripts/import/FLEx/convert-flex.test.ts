// import { data } from './Babanki-Kejom'; **Note that data files aren't in this repo**
import { convertFLExToLDFormat } from './convert-flex';

test.skip('Convert Babanki', async () => {
  const entries = convertFLExToLDFormat([]);
  // const entries = convertFLExToLDFormat(data);
  entries.length /*?*/;
  // console.log(entries);
});

// test('parts of speech are mapped correctly', () => {
//   expect(matchPartsOfSpeech('Adverb')).toBe('adv');
//   expect(matchPartsOfSpeech('pro indef')).toBe('indfpro');
//   expect(matchPartsOfSpeech('con')).toBe('con');
// })

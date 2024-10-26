import { friendlyName } from './friendlyName'

test('friendlyName returns filename with proper file extensions', () => {
  expect(friendlyName({ id: '1234', senses: [{ glosses: { en: 'food' } }] }, 'e3j3jsi.jpg')).toBe(
    '1234_food.jpg',
  )
  expect(friendlyName({ id: '1234', senses: [{ glosses: { en: 'food' } }] }, 'e3j3jsi.wav')).toBe(
    '1234_food.wav',
  )
})

test('friendlyName returns second gloss or no gloss if first gloss or gloss object does not exist', () => {
  expect(
    friendlyName({ id: '1234', senses: [{ glosses: { en: '', es: 'comida' } }] }, 'e3j3jsi.jpg'),
  ).toBe('1234_comida.jpg')
  expect(friendlyName({ id: '1234', senses: [{ glosses: { en: '' } }] }, 'e3j3jsi.wav')).toBe(
    '1234_.wav',
  )
  expect(friendlyName({ id: '1234' }, 'e3j3jsi.wav')).toBe('1234_.wav')
})

test('friendlyName simplifies complicated glosses and strips out non a-z characters', () => {
  expect(
    friendlyName({ id: '1234', senses: [{ glosses: { en: 'How was your day?' } }] }, 'e3j3jsi.jpg'),
  ).toBe('1234_How_was_your_day.jpg')
})

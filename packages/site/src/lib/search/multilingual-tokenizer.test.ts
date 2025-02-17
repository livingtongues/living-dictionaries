import { tokenize } from './multilingual-tokenizer'

describe(tokenize, () => {
  test('lexemes are searchable starting at any letter', () => {
    expect(tokenize('esïtmon', null, '_lexeme')).toMatchInlineSnapshot(`
      [
        "esïtmon",
        "esitmon",
        "sïtmon",
        "sitmon",
        "ïtmon",
        "itmon",
        "tmon",
        "mon",
        "on",
      ]
    `)
  })

  test('lexemes with 1 letter still work', () => {
    expect(tokenize('a', null, '_lexeme')).toEqual(['a'])
  })

  test('glosses are not normalized', () => {
    expect(tokenize('esotmïn', null, '_glosses')).toEqual(['esotmïn'])
  })
})

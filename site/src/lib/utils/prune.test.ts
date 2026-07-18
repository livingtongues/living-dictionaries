import { prune_object } from './prune'

test('prune_object removes empty string, empty array, null, false, and undefined at root and nested level', () => {
  expect(
    prune_object({
      id: '1234',
      myArrayWithStuff: ['test'],
      emptyString: '',
      emptyArray: [],
      foo: null,
      baz: false,
      bar: undefined,
      nested: {
        name: 'test',
        withStuff: ['hello', 'world'],
        en: '',
        emptyArray: [],
        zh: null,
        de: null,
        show: false,
        that: undefined,
      },
    }),
  ).toMatchInlineSnapshot(`
    {
      "baz": false,
      "id": "1234",
      "myArrayWithStuff": [
        "test",
      ],
      "nested": {
        "name": "test",
        "show": false,
        "withStuff": [
          "hello",
          "world",
        ],
      },
    }
  `)
})

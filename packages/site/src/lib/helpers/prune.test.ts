import { pruneObject } from './prune';

test('pruneObject removes empty string, empty array, null, false, and undefined at root and nested level', () => {
  expect(
    pruneObject({
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
    })
  ).toMatchInlineSnapshot(`
    Object {
      "id": "1234",
      "myArrayWithStuff": Array [
        "test",
      ],
      "nested": Object {
        "name": "test",
        "withStuff": Array [
          "hello",
          "world",
        ],
      },
    }
  `);
});

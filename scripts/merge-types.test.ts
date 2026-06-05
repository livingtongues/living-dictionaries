import { merge_content } from './merge-types'

describe(merge_content, () => {
  test('merges types and keeps string literals', () => {
    const generated_content = `
export interface Database {
  public: { 
    Tables: {
      entries: {
        Row: {
          bar: Json
          foo: string
          bee: Json
        }
      }
      updates: {
        Row: {
          date: string
          foreignKeyName: 'videos_created_by_fkey'
          columns: ['created_by']
        }
      }
    }
  }
}`

    const augments_content = `
export interface DatabaseAugments {
  public: { 
    Tables: {
      entries: {
        Row: {
          bar: Bajinga
          bee: Hiya
        }
      }
    }
  }
}`

    expect(merge_content(generated_content, augments_content)).toMatchInlineSnapshot(`
      "export interface Database {
          public: {
              Tables: {
                  entries: {
                      Row: {
                          bar: Bajinga;
                          foo: string;
                          bee: Hiya;
                      };
                  };
                  updates: {
                      Row: {
                          date: string;
                          foreignKeyName: 'videos_created_by_fkey';
                          columns: [
                              'created_by'
                          ];
                      };
                  };
              };
          };
      }
      "
    `)
  })

  test('strips out Json type', () => {
    const generated_content = `
export type Json = string | number
export interface Database {}`

    const augments_content = `export interface DatabaseAugments {}`

    expect(merge_content(generated_content, augments_content)).toMatchInlineSnapshot(`
      "export interface Database {
      }
      "
    `)
  })
})

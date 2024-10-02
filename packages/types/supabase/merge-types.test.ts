import fs from 'node:fs'
import * as ts from 'typescript'

const generated_file_path = 'packages/types/supabase/generated.types.ts'
const augments_file_path = 'packages/types/supabase/augments.types.ts'

function read_file(file_path: string): string {
  return fs.readFileSync(file_path, 'utf8')
}

function parse_file_to_ast(file_name: string, file_content: string): ts.SourceFile {
  return ts.createSourceFile(
    file_name,
    file_content,
    ts.ScriptTarget.ESNext,
    true,
  )
}

function get_interface(source_file: ts.SourceFile, interface_name: string): ts.InterfaceDeclaration {
  let type_interface: ts.InterfaceDeclaration

  function visit(node: ts.Node) {
    if (type_interface) return

    if (!type_interface && ts.isInterfaceDeclaration(node) && node.name.text === interface_name) {
      type_interface = node
      return
    }
    ts.forEachChild(node, visit)
  }

  visit(source_file)

  return type_interface
}

function merge_interfaces(
  original_interface: ts.InterfaceDeclaration,
  augments_interface: ts.InterfaceDeclaration,
): ts.InterfaceDeclaration {
  function visit(node: ts.Node, parents_names: string[]) {
    if (ts.isPropertySignature(node)) {
      const property_name = node.name.getText()
      const property_type = node.type?.getText()
      const hasChildren = property_type.includes('{')
      if (!hasChildren) {
        updateOriginalInterface(original_interface, parents_names, property_name, property_type)
      }
    }

    ts.forEachChild(node, (child) => {
      const new_parents_names = ts.isPropertySignature(node) && node.name ? [...parents_names, node.name.getText()] : parents_names
      visit(child, new_parents_names)
    })
  }

  function updateOriginalInterface(
    original_interface: ts.InterfaceDeclaration,
    parents_names: string[],
    property_name: string,
    property_type: string,
  ) {
    function findAndModify(node: ts.Node, parents_names: string[], property_name: string, property_type: string) {
      if (ts.isPropertySignature(node)) {
        const current_property_name = node.name.getText()
        if (parents_names.length === 0 && current_property_name === property_name) {
          // @ts-expect-error
          node.type = ts.factory.createTypeReferenceNode(property_type, [])
        } else if (parents_names.length > 0 && current_property_name === parents_names[0]) {
          ts.forEachChild(node, (child) => {
            findAndModify(child, parents_names.slice(1), property_name, property_type)
          })
        }
      } else {
        ts.forEachChild(node, (child) => {
          findAndModify(child, parents_names, property_name, property_type)
        })
      }
    }

    findAndModify(original_interface, parents_names, property_name, property_type)
  }

  visit(augments_interface, [])

  return original_interface
}

function print_ast(ast: ts.SourceFile, modified_interface: ts.InterfaceDeclaration, interface_name: string): string {
  const printer = ts.createPrinter()
  let result = ''

  ts.forEachChild(ast, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interface_name) {
      result += `${printer.printNode(ts.EmitHint.Unspecified, modified_interface, ast)}\n`
    } else if (ts.isTypeAliasDeclaration(node) && node.name.text !== 'Json') {
      result += `${printer.printNode(ts.EmitHint.Unspecified, node, ast)}\n`
    }
  })

  return result
}

function merge_content(generated_content: string, augments_content: string): string {
  const generated_ast = parse_file_to_ast(generated_file_path, generated_content)
  const augments_ast = parse_file_to_ast(augments_file_path, augments_content)

  const generated_interface = get_interface(generated_ast, 'Database')
  const augments_interface = get_interface(augments_ast, 'DatabaseAugments')

  const modified_interface = merge_interfaces(generated_interface, augments_interface)
  return print_ast(generated_ast, modified_interface, 'Database')
}

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

  test('update actual types', () => {
    const generated_content = read_file(generated_file_path)
    const augments_content = read_file(augments_file_path)
    const output = merge_content(generated_content, augments_content)

    const imports_regex = /^(import type.+)/gm
    const import_blocks = augments_content.match(imports_regex)
    const augmented_import_blocks = import_blocks!.join('\n')
    expect(`${augmented_import_blocks}\n\n${output}`).toMatchFileSnapshot(`combined.types.ts`)
  })
})

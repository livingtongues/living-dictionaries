import { describe, expect, test } from 'vitest'
import type { GrammarSectionLike } from './grammar-tree'
import {
  after_sibling_key,
  append_child_key,
  build_section_tree,
  flatten_tree,
  move_down_key,
  move_up_key,
  ordered_children,
} from './grammar-tree'
import { initial_keys, key_between } from '$lib/api/v1/fractional-index'

function section(id: string, parent_id: string | null, sort_key: string, number_label?: string): GrammarSectionLike {
  return { id, parent_id, sort_key, number_label }
}

/** True when every key sorts strictly before the next — the ordering invariant. */
function sorted(keys: string[]): boolean {
  for (let i = 1; i < keys.length; i++) {
    if (keys[i - 1] >= keys[i])
      return false
  }
  return true
}

describe(build_section_tree, () => {
  test('nests children under parents and orders siblings by sort_key', () => {
    const [a, b, c] = initial_keys(3)
    const rows = [
      section('root-2', null, b),
      section('root-1', null, a),
      section('child-1b', 'root-1', b),
      section('child-1a', 'root-1', a),
      section('root-3', null, c),
    ]
    const tree = build_section_tree(rows)
    expect(tree.map(node => node.section.id)).toEqual(['root-1', 'root-2', 'root-3'])
    expect(tree[0].children.map(node => node.section.id)).toEqual(['child-1a', 'child-1b'])
  })

  test('derives dotted positional numbers and honors an explicit number_label', () => {
    const [a, b] = initial_keys(2)
    const rows = [
      section('r1', null, a),
      section('r2', null, b, '2.2.1.1'),
      section('c1', 'r1', a),
      section('c2', 'r1', b),
      section('gc1', 'c2', a),
    ]
    const tree = build_section_tree(rows)
    expect(tree[0].number).toBe('1')
    expect(tree[0].children[0].number).toBe('1.1')
    expect(tree[0].children[1].number).toBe('1.2')
    expect(tree[0].children[1].children[0].number).toBe('1.2.1')
    // explicit label overrides the positional one for its own node
    expect(tree[1].number).toBe('2.2.1.1')
    expect(tree[1].positional_number).toBe('2')
  })

  test('treats a row with a missing/self parent as a root so nothing hides', () => {
    const [a, b] = initial_keys(2)
    const rows = [
      section('orphan', 'gone', a),
      section('selfref', 'selfref', b),
    ]
    const tree = build_section_tree(rows)
    expect(tree.map(node => node.section.id).sort()).toEqual(['orphan', 'selfref'])
  })

  test('tracks depth for indentation', () => {
    const [a] = initial_keys(1)
    const rows = [
      section('r', null, a),
      section('c', 'r', a),
      section('gc', 'c', a),
    ]
    const flat = flatten_tree(build_section_tree(rows))
    expect(flat.map(node => [node.section.id, node.depth])).toEqual([['r', 0], ['c', 1], ['gc', 2]])
  })
})

describe(ordered_children, () => {
  test('returns the ordered siblings under a parent', () => {
    const [a, b] = initial_keys(2)
    const rows = [
      section('r2', null, b),
      section('r1', null, a),
      section('c2', 'r1', b),
      section('c1', 'r1', a),
    ]
    expect(ordered_children(rows, null).map(row => row.id)).toEqual(['r1', 'r2'])
    expect(ordered_children(rows, 'r1').map(row => row.id)).toEqual(['c1', 'c2'])
  })

  test('counts an orphan-parented row as a root', () => {
    const [a] = initial_keys(1)
    const rows = [section('orphan', 'gone', a)]
    expect(ordered_children(rows, null).map(row => row.id)).toEqual(['orphan'])
  })
})

describe(move_up_key, () => {
  test('returns null for the first item', () => {
    const keys = initial_keys(3)
    expect(move_up_key(keys, 0)).toBeNull()
  })

  test('produces a key that sorts before the previous sibling', () => {
    const keys = initial_keys(3)
    const new_key = move_up_key(keys, 2)
    expect(new_key).not.toBeNull()
    // moved item now sorts between keys[0] and keys[1]
    expect(sorted([keys[0], new_key as string, keys[1]])).toBeTruthy()
  })

  test('moving index 1 up places it before the first item', () => {
    const keys = initial_keys(3)
    const new_key = move_up_key(keys, 1) as string
    expect(sorted([new_key, keys[0]])).toBeTruthy()
  })
})

describe(move_down_key, () => {
  test('returns null for the last item', () => {
    const keys = initial_keys(3)
    expect(move_down_key(keys, 2)).toBeNull()
  })

  test('produces a key that sorts after the next sibling', () => {
    const keys = initial_keys(3)
    const new_key = move_down_key(keys, 0) as string
    expect(sorted([keys[1], new_key, keys[2]])).toBeTruthy()
  })

  test('moving the second-to-last down places it after the last', () => {
    const keys = initial_keys(3)
    const new_key = move_down_key(keys, 1) as string
    expect(sorted([keys[2], new_key])).toBeTruthy()
  })
})

describe(append_child_key, () => {
  test('appends after the last existing child', () => {
    const keys = initial_keys(2)
    const new_key = append_child_key(keys)
    expect(sorted([keys[1], new_key])).toBeTruthy()
  })

  test('mints a first key when there are no children', () => {
    const new_key = append_child_key([])
    expect(typeof new_key).toBe('string')
    expect(new_key).not.toBe('')
  })
})

describe(after_sibling_key, () => {
  test('places a node right after its former parent among the grandparent list', () => {
    const [parent_key, uncle_key] = initial_keys(2)
    const new_key = after_sibling_key(parent_key, uncle_key)
    expect(sorted([parent_key, new_key, uncle_key])).toBeTruthy()
  })

  test('appends after the parent when there is no following uncle', () => {
    const [parent_key] = initial_keys(1)
    const new_key = after_sibling_key(parent_key, null)
    expect(sorted([parent_key, new_key])).toBeTruthy()
    // consistent with key_between semantics
    expect(new_key).toBe(key_between(parent_key, null))
  })
})

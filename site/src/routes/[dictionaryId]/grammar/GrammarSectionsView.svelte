<script lang="ts">
  import { page } from '$app/state'
  import GrammarSection from './GrammarSection.svelte'
  import {
    after_sibling_key,
    append_child_key,
    build_section_tree,
    move_down_key,
    move_up_key,
  } from './grammar-tree'
  import type { GrammarNode, GrammarSectionActions } from './grammar-section-actions'
  import IconFaSolidPlus from '~icons/fa-solid/plus'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'

  interface Props {
    /** Whether the current user may add/reorder/nest/edit (admin-3 during preview). */
    editable: boolean
  }

  const { editable }: Props = $props()

  const { t, dict_db } = $derived(page.data)

  // Mirror the text reader's live-read pattern: read `.rows` in a $derived that
  // depends only on the stable `dict_db` (not a churning live object).
  const rows = $derived([...(dict_db?.grammar_sections.rows ?? [])])
  const loading = $derived(dict_db?.grammar_sections.loading ?? true)
  const tree = $derived(build_section_tree(rows))

  let editing_id = $state<string | null>(null)

  // id → parent node (null at root) — lets the ops find a section's
  // siblings/children straight off the built (already-normalized) tree.
  const parent_by_id = $derived.by(() => {
    const map: Record<string, GrammarNode | null> = {}
    function walk(nodes: GrammarNode[], parent: GrammarNode | null) {
      for (const node of nodes) {
        map[node.section.id] = parent
        walk(node.children, node)
      }
    }
    walk(tree, null)
    return map
  })

  function siblings_of(node: GrammarNode): GrammarNode[] {
    const parent = parent_by_id[node.section.id] ?? null
    return parent ? parent.children : tree
  }

  function collect_ids(node: GrammarNode): string[] {
    return [node.section.id, ...node.children.flatMap(collect_ids)]
  }

  async function persist(node: GrammarNode, change: { sort_key?: string, parent_id?: string | null }) {
    Object.assign(node.section, change)
    await node.section._save()
  }

  const actions: GrammarSectionActions = {
    get editable() { return editable },
    get editing_id() { return editing_id },
    set_editing: (id) => { editing_id = id },

    move_up: async (node) => {
      const keys = siblings_of(node).map(sibling => sibling.section.sort_key)
      const sort_key = move_up_key(keys, node.index)
      if (sort_key) await persist(node, { sort_key })
    },

    move_down: async (node) => {
      const keys = siblings_of(node).map(sibling => sibling.section.sort_key)
      const sort_key = move_down_key(keys, node.index)
      if (sort_key) await persist(node, { sort_key })
    },

    // Become the last child of the previous sibling.
    indent: async (node) => {
      const siblings = siblings_of(node)
      const previous = siblings[node.index - 1]
      if (!previous) return
      const sort_key = append_child_key(previous.children.map(child => child.section.sort_key))
      await persist(node, { parent_id: previous.section.id, sort_key })
    },

    // Become the next sibling of the current parent (one level shallower).
    outdent: async (node) => {
      const parent = parent_by_id[node.section.id]
      if (!parent) return
      const grandparent = parent_by_id[parent.section.id] ?? null
      const uncles = grandparent ? grandparent.children : tree
      const next_uncle = uncles[parent.index + 1]
      const sort_key = after_sibling_key(parent.section.sort_key, next_uncle?.section.sort_key ?? null)
      await persist(node, { parent_id: parent.section.parent_id ?? null, sort_key })
    },

    remove: async (node) => {
      if (!confirm(t('grammar.delete_section_confirm'))) return
      if (editing_id && collect_ids(node).includes(editing_id)) editing_id = null
      await dict_db.grammar_sections.delete(collect_ids(node))
    },

    add_child: async (node) => {
      const sort_key = append_child_key(node.children.map(child => child.section.sort_key))
      const [row] = await dict_db.grammar_sections.insert({ parent_id: node.section.id, sort_key })
      if (row) editing_id = row.id
    },
  }

  async function add_root_section() {
    const sort_key = append_child_key(tree.map(node => node.section.sort_key))
    const [row] = await dict_db.grammar_sections.insert({ parent_id: null, sort_key })
    if (row) editing_id = row.id
  }
</script>

<div class="sections">
  {#if loading}
    <div class="state-note"><IconSvgSpinners3DotsFade /></div>
  {:else}
    {#each tree as node (node.section.id)}
      <GrammarSection {node} {actions} />
    {/each}

    {#if !tree.length && !editable}
      <p class="state-note"><i>{t('dictionary.no_info_yet')}</i></p>
    {/if}

    {#if editable}
      <button type="button" class="add-root" onclick={add_root_section}>
        <IconFaSolidPlus /> {t('grammar.add_section')}
      </button>
    {/if}
  {/if}
</div>

<style>
  .sections {
    margin-top: 0.5rem;
  }

  .state-note {
    padding: 1.5rem 0;
    color: var(--color-secondary);
  }

  .add-root {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.5rem 0.875rem;
    border: 1px dashed var(--border-color);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--color-secondary);
    font-size: 0.9375rem;
    cursor: pointer;
  }

  .add-root:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
</style>

<script lang="ts">
  import { page } from '$app/state'
  import Self from './GrammarSection.svelte'
  import SectionEditor from './SectionEditor.svelte'
  import GrammarExampleSentence from './GrammarExampleSentence.svelte'
  import { prose_editable_node } from './grammar-section-actions'
  import type { GrammarNode, GrammarSectionActions } from './grammar-section-actions'
  import { render_markdown_to_html } from '$lib/markdown/render'
  import { sanitize_rich_text as sanitize } from '$lib/markdown/sanitize-rich-text'
  import { get_headword } from '$lib/helpers/orthographies'
  import { first_multistring_value } from './grammar-tree'
  import type { MultiString } from '$lib/types'
  import IconFa6SolidPencil from '~icons/fa6-solid/pencil'
  import IconMdiChevronUp from '~icons/mdi/chevron-up'
  import IconMdiChevronDown from '~icons/mdi/chevron-down'
  import IconMdiFormatIndentIncrease from '~icons/mdi/format-indent-increase'
  import IconMdiFormatIndentDecrease from '~icons/mdi/format-indent-decrease'
  import IconSystemUiconsTrash from '~icons/system-uicons/trash'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    node: GrammarNode
    actions: GrammarSectionActions
  }

  const { node, actions }: Props = $props()
  const { t, dictionary, entries_data, dict_db } = $derived(page.data)

  const section = $derived(node.section)
  const is_editing = $derived(actions.editing_id === section.id)

  // Managers (non-admin-3) may edit the migrated intro's prose only; admin-3 has
  // full structural editing on every node.
  const can_prose_edit = $derived(!actions.editable && actions.prose_editable && prose_editable_node(node))
  const can_edit = $derived(actions.editable || can_prose_edit)

  function present_languages(field: MultiString | null | undefined): string[] {
    if (!field) return []
    return Object.keys(field).filter(bcp => field[bcp]?.trim())
  }

  const title_languages = $derived(present_languages(section.title))
  const body_languages = $derived(present_languages(section.body))
  const usage_languages = $derived(present_languages(section.usage_conditions))
  const multilingual = $derived((dictionary.gloss_languages?.length ?? 0) > 1)

  function language_label(bcp: string): string {
    return t({ dynamicKey: `gl.${bcp}`, fallback: bcp })
  }

  const linked_entry = $derived(section.entry_id ? $entries_data[section.entry_id] : undefined)
  const linked_lexeme = $derived(linked_entry
    ? get_headword({ lexeme: linked_entry.main.lexeme, orthographies: dictionary.orthographies }).value
    : '')

  const slot = $derived(section.slot_id ? dict_db?.clause_slots.id(section.slot_id) : undefined)
  const slot_label = $derived(slot ? first_multistring_value(slot.name, dictionary.gloss_languages) : '')

  // Attached example sentences (ordered) — read-only render below the prose.
  const example_sentences = $derived([...(dict_db?.section_sentences.rows ?? [])]
    .filter(link => link.section_id === section.id)
    .sort((first, second) => (first.sort_key || '').localeCompare(second.sort_key || ''))
    .map(link => dict_db?.sentences.id(link.sentence_id))
    .filter((sentence): sentence is NonNullable<typeof sentence> => !!sentence))

  const is_empty = $derived(!title_languages.length && !body_languages.length && !usage_languages.length)
</script>

<div class="section" id={`section-${section.id}`} style={`--depth: ${node.depth}`}>
  <div class="head">
    <span class="number">{node.number}</span>
    {#if title_languages.length}
      <div class="titles">
        {#each title_languages as bcp (bcp)}
          <span class="title" style={`font-size: ${1.35 - node.depth * 0.12}rem`}>
            {#if multilingual}<span class="lang-tag">{language_label(bcp)}</span>{/if}
            {section.title?.[bcp]}
          </span>
        {/each}
      </div>
    {:else if is_empty}
      <span class="untitled">{t('grammar.untitled_section')}</span>
    {/if}

    {#if section.entry_id}
      <a class="entry-chip" href={`/${dictionary.url}/entry/${section.entry_id}`}>
        {linked_lexeme || t('grammar.linked_entry')}
      </a>
    {/if}

    {#if slot_label}
      <span class="slot-badge" title={t('grammar.clause_slot')}>{slot_label}</span>
    {/if}

    {#if can_edit}
      <div class="controls">
        <button type="button" class="ctrl" title={t('misc.edit')} aria-label={t('misc.edit')} onclick={() => actions.set_editing(is_editing ? null : section.id)}>
          <IconFa6SolidPencil />
        </button>
        {#if actions.editable}
          <button type="button" class="ctrl" title={t('grammar.move_up')} aria-label={t('grammar.move_up')} disabled={node.index === 0} onclick={() => actions.move_up(node)}>
            <IconMdiChevronUp />
          </button>
          <button type="button" class="ctrl" title={t('grammar.move_down')} aria-label={t('grammar.move_down')} disabled={node.index >= node.sibling_count - 1} onclick={() => actions.move_down(node)}>
            <IconMdiChevronDown />
          </button>
          <button type="button" class="ctrl" title={t('grammar.indent')} aria-label={t('grammar.indent')} disabled={node.index === 0} onclick={() => actions.indent(node)}>
            <IconMdiFormatIndentIncrease />
          </button>
          <button type="button" class="ctrl" title={t('grammar.outdent')} aria-label={t('grammar.outdent')} disabled={node.depth === 0} onclick={() => actions.outdent(node)}>
            <IconMdiFormatIndentDecrease />
          </button>
          <button type="button" class="ctrl danger" title={t('misc.delete')} aria-label={t('misc.delete')} onclick={() => actions.remove(node)}>
            <IconSystemUiconsTrash />
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if is_editing}
    <SectionEditor {section} prose_only={!actions.editable} on_close={() => actions.set_editing(null)} />
  {:else}
    {#each body_languages as bcp (bcp)}
      <div class="body tw-prose">
        {#if multilingual}<span class="lang-tag body-lang">{language_label(bcp)}</span>{/if}
        {@html sanitize(render_markdown_to_html(section.body?.[bcp] || ''))}
      </div>
    {/each}

    {#if usage_languages.length}
      <div class="usage">
        <span class="usage-label">{t('grammar.usage_conditions')}</span>
        {#each usage_languages as bcp (bcp)}
          <div class="body tw-prose">
            {#if multilingual}<span class="lang-tag body-lang">{language_label(bcp)}</span>{/if}
            {@html sanitize(render_markdown_to_html(section.usage_conditions?.[bcp] || ''))}
          </div>
        {/each}
      </div>
    {/if}

    {#if example_sentences.length}
      <div class="examples">
        {#each example_sentences as sentence (sentence.id)}
          <GrammarExampleSentence {sentence} />
        {/each}
      </div>
    {/if}
  {/if}

  {#if node.children.length}
    <div class="children">
      {#each node.children as child (child.section.id)}
        <Self node={child} {actions} />
      {/each}
    </div>
  {/if}

  {#if actions.editable}
    <button type="button" class="add-child" onclick={() => actions.add_child(node)}>
      <IconFaSolidPlus /> {t('grammar.add_subsection')}
    </button>
  {/if}
</div>

<style>
  .section {
    border-left: 2px solid color-mix(in srgb, var(--primary) 30%, transparent);
    padding-left: 0.875rem;
    margin: 0.5rem 0 0.5rem calc(var(--depth) * 0.25rem);
  }

  .head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .number {
    font-variant-numeric: tabular-nums;
    color: var(--color-secondary);
    font-weight: 600;
    font-size: 0.875rem;
    min-width: 1.5rem;
  }

  .titles {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .title {
    font-weight: 600;
    line-height: 1.25;
  }

  .untitled {
    color: var(--color-secondary);
    font-style: italic;
  }

  .lang-tag {
    display: inline-block;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin-right: 0.375rem;
  }

  .entry-chip {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: var(--primary);
    text-decoration: none;
  }

  .entry-chip:hover {
    background: color-mix(in srgb, var(--primary) 20%, var(--background));
  }

  .slot-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem 0.5rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--color-secondary);
    background: color-mix(in srgb, var(--color) 8%, var(--background));
  }

  .controls {
    display: flex;
    gap: 0.125rem;
    margin-left: auto;
  }

  .ctrl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    border: 0;
    background: transparent;
    color: var(--color-secondary);
    cursor: pointer;
  }

  .ctrl:hover:not(:disabled) {
    background: var(--surface);
    color: var(--color);
  }

  .ctrl:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .ctrl.danger:hover {
    color: var(--danger);
  }

  .body {
    margin-top: 0.375rem;
  }

  .body-lang {
    display: block;
    margin-bottom: 0.125rem;
  }

  .usage {
    margin-top: 0.625rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--color) 4%, var(--background));
  }

  .usage-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin-bottom: 0.25rem;
  }

  .examples {
    margin-top: 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .children {
    margin-top: 0.25rem;
  }

  .add-child {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.375rem;
    padding: 0.25rem 0.5rem;
    border: 1px dashed var(--border-color);
    border-radius: 0.375rem;
    background: transparent;
    color: var(--color-secondary);
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .add-child:hover {
    color: var(--primary);
    border-color: var(--primary);
  }
</style>

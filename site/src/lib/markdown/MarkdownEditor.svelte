<script lang="ts">
  import { Editor } from '@tiptap/core'
  import { Placeholder } from '@tiptap/extension-placeholder'
  import { onDestroy, onMount } from 'svelte'
  import { create_editor_tick } from '$lib/state/editor-tick.svelte'
  import { create_markdown_extensions, get_editor_markdown } from './extensions'
  import IconMdiFormatBold from '~icons/mdi/format-bold'
  import IconMdiFormatHeader1 from '~icons/mdi/format-header-1'
  import IconMdiFormatHeader2 from '~icons/mdi/format-header-2'
  import IconMdiFormatHeader3 from '~icons/mdi/format-header-3'
  import IconMdiFormatItalic from '~icons/mdi/format-italic'
  import IconMdiFormatListBulleted from '~icons/mdi/format-list-bulleted'
  import IconMdiFormatListNumbered from '~icons/mdi/format-list-numbered'
  import IconMdiFormatQuoteClose from '~icons/mdi/format-quote-close'
  import IconMdiImagePlus from '~icons/mdi/image-plus'
  import IconMdiLinkVariant from '~icons/mdi/link-variant'
  import IconMdiMinus from '~icons/mdi/minus'
  import IconMdiRedo from '~icons/mdi/redo'
  import IconMdiTableColumn from '~icons/mdi/table-column'
  import IconMdiTableColumnPlusAfter from '~icons/mdi/table-column-plus-after'
  import IconMdiTableColumnRemove from '~icons/mdi/table-column-remove'
  import IconMdiTableHeadersEye from '~icons/mdi/table-headers-eye'
  import IconMdiTableMergeCells from '~icons/mdi/table-merge-cells'
  import IconMdiTablePlus from '~icons/mdi/table-plus'
  import IconMdiTableRemove from '~icons/mdi/table-remove'
  import IconMdiTableRowPlusAfter from '~icons/mdi/table-row-plus-after'
  import IconMdiTableRowRemove from '~icons/mdi/table-row-remove'
  import IconMdiTableSplitCell from '~icons/mdi/table-split-cell'
  import IconMdiUndo from '~icons/mdi/undo'

  interface Props {
    /** Markdown content (bindable for parent-driven resets). */
    value?: string
    /** Fires on every content change with the live markdown. */
    on_change?: (markdown: string) => void
    placeholder?: string
    disabled?: boolean
    /** `document` = about/grammar (headings, hr, image); `minimal` = entry notes. */
    preset?: 'document' | 'minimal'
  }

  let {
    value = $bindable(),
    on_change,
    placeholder = '',
    disabled = false,
    preset = 'document',
  }: Props = $props()

  // $state.raw — Svelte's deep proxy would break Tiptap's class instance.
  let editor: Editor | null = $state.raw(null)
  let element: HTMLDivElement | undefined = $state()
  const tick = create_editor_tick()
  let suppressing_update = false
  let last_external_value: string | null = null

  function emit_markdown(edited: Editor) {
    const markdown = get_editor_markdown(edited)
    last_external_value = markdown
    value = markdown
    on_change?.(markdown)
  }

  // Static imports keep the mount synchronous: this child's onMount runs before
  // the parent's (Keyman relies on finding `.ProseMirror` when it initializes).
  // Code-splitting still happens — usage sites dynamic-import this component.
  onMount(() => {
    last_external_value = value
    editor = new Editor({
      element,
      extensions: [
        ...create_markdown_extensions(),
        Placeholder.configure({ placeholder }),
      ],
      content: value,
      editable: !disabled,
      onUpdate: ({ editor: edited }) => {
        if (suppressing_update)
          return
        emit_markdown(edited)
      },
      onTransaction: () => {
        // ProseMirror dispatches a blur transaction synchronously during teardown,
        // which lands inside Svelte's block-effect/derived context — a direct
        // `tick++` there throws state_unsafe_mutation. `create_editor_tick`
        // defers it out of that context and drops it once torn down.
        tick.bump()
      },
      editorProps: {
        attributes: { class: 'tw-prose markdown-editor-content' },
      },
    })
  })

  onDestroy(() => {
    tick.stop()
    editor?.destroy()
  })

  // Sync external value resets (parent loads a doc / clears).
  $effect(() => {
    if (!editor)
      return
    if (value === last_external_value)
      return
    last_external_value = value
    suppressing_update = true
    try {
      editor.commands.setContent(value || '', { emitUpdate: false })
    } finally {
      suppressing_update = false
    }
  })

  $effect(() => {
    if (editor && editor.isEditable !== !disabled)
      editor.setEditable(!disabled)
  })

  function toggle_bold() { editor?.chain().focus().toggleBold().run() }
  function toggle_italic() { editor?.chain().focus().toggleItalic().run() }
  function toggle_bullet_list() { editor?.chain().focus().toggleBulletList().run() }
  function toggle_ordered_list() { editor?.chain().focus().toggleOrderedList().run() }
  function toggle_blockquote() { editor?.chain().focus().toggleBlockquote().run() }
  function set_horizontal_rule() { editor?.chain().focus().setHorizontalRule().run() }
  function set_heading(level: 1 | 2 | 3) { editor?.chain().focus().toggleHeading({ level }).run() }
  function undo() { editor?.chain().focus().undo().run() }
  function redo() { editor?.chain().focus().redo().run() }
  function insert_table() { editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }
  function add_row_after() { editor?.chain().focus().addRowAfter().run() }
  function delete_row() { editor?.chain().focus().deleteRow().run() }
  function add_column_after() { editor?.chain().focus().addColumnAfter().run() }
  function delete_column() { editor?.chain().focus().deleteColumn().run() }
  function toggle_header_row() { editor?.chain().focus().toggleHeaderRow().run() }
  function toggle_header_column() { editor?.chain().focus().toggleHeaderColumn().run() }
  function merge_cells() { editor?.chain().focus().mergeCells().run() }
  function split_cell() { editor?.chain().focus().splitCell().run() }
  function delete_table() { editor?.chain().focus().deleteTable().run() }

  function toggle_link() {
    if (!editor)
      return
    const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
    const url = window.prompt('Link URL (leave blank to remove)', previous)
    if (url === null)
      return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  function insert_image() {
    if (!editor)
      return
    const url = window.prompt('Image URL')
    if (!url)
      return
    editor.chain().focus().setImage({ src: url }).run()
  }

  const bold_active = $derived.by(() => { void tick.value; return editor?.isActive('bold') ?? false })
  const italic_active = $derived.by(() => { void tick.value; return editor?.isActive('italic') ?? false })
  const link_active = $derived.by(() => { void tick.value; return editor?.isActive('link') ?? false })
  const bullet_list_active = $derived.by(() => { void tick.value; return editor?.isActive('bulletList') ?? false })
  const ordered_list_active = $derived.by(() => { void tick.value; return editor?.isActive('orderedList') ?? false })
  const blockquote_active = $derived.by(() => { void tick.value; return editor?.isActive('blockquote') ?? false })
  const heading_1_active = $derived.by(() => { void tick.value; return editor?.isActive('heading', { level: 1 }) ?? false })
  const heading_2_active = $derived.by(() => { void tick.value; return editor?.isActive('heading', { level: 2 }) ?? false })
  const heading_3_active = $derived.by(() => { void tick.value; return editor?.isActive('heading', { level: 3 }) ?? false })
  const can_undo = $derived.by(() => { void tick.value; return editor?.can().undo() ?? false })
  const can_redo = $derived.by(() => { void tick.value; return editor?.can().redo() ?? false })
  const in_table = $derived.by(() => { void tick.value; return editor?.isActive('table') ?? false })
  const can_merge_cells = $derived.by(() => { void tick.value; return editor?.can().mergeCells() ?? false })
  const can_split_cell = $derived.by(() => { void tick.value; return editor?.can().splitCell() ?? false })
</script>

<div class="markdown-editor" class:disabled>
  <div class="toolbar">
    {#if preset === 'document'}
      <button type="button" onclick={() => set_heading(1)} class:active={heading_1_active} disabled={disabled || !editor} title="Heading 1" aria-label="Heading 1"><IconMdiFormatHeader1 /></button>
      <button type="button" onclick={() => set_heading(2)} class:active={heading_2_active} disabled={disabled || !editor} title="Heading 2" aria-label="Heading 2"><IconMdiFormatHeader2 /></button>
      <button type="button" onclick={() => set_heading(3)} class:active={heading_3_active} disabled={disabled || !editor} title="Heading 3" aria-label="Heading 3"><IconMdiFormatHeader3 /></button>
      <span class="separator"></span>
    {/if}
    <button type="button" onclick={toggle_bold} class:active={bold_active} disabled={disabled || !editor} title="Bold (Ctrl+B)" aria-label="Bold"><IconMdiFormatBold /></button>
    <button type="button" onclick={toggle_italic} class:active={italic_active} disabled={disabled || !editor} title="Italic (Ctrl+I)" aria-label="Italic"><IconMdiFormatItalic /></button>
    <button type="button" onclick={toggle_link} class:active={link_active} disabled={disabled || !editor} title="Link" aria-label="Link"><IconMdiLinkVariant /></button>
    <span class="separator"></span>
    <button type="button" onclick={toggle_bullet_list} class:active={bullet_list_active} disabled={disabled || !editor} title="Bullet list" aria-label="Bullet list"><IconMdiFormatListBulleted /></button>
    <button type="button" onclick={toggle_ordered_list} class:active={ordered_list_active} disabled={disabled || !editor} title="Numbered list" aria-label="Numbered list"><IconMdiFormatListNumbered /></button>
    <button type="button" onclick={toggle_blockquote} class:active={blockquote_active} disabled={disabled || !editor} title="Quote" aria-label="Quote"><IconMdiFormatQuoteClose /></button>
    {#if preset === 'document'}
      <button type="button" onclick={set_horizontal_rule} disabled={disabled || !editor} title="Divider" aria-label="Divider"><IconMdiMinus /></button>
      <button type="button" onclick={insert_image} disabled={disabled || !editor} title="Insert image from URL" aria-label="Insert image from URL"><IconMdiImagePlus /></button>
      <button type="button" onclick={insert_table} disabled={disabled || !editor || in_table} title="Insert table" aria-label="Insert table"><IconMdiTablePlus /></button>
    {/if}
    <span class="separator"></span>
    <button type="button" onclick={undo} disabled={disabled || !can_undo || !editor} title="Undo (Ctrl+Z)" aria-label="Undo"><IconMdiUndo /></button>
    <button type="button" onclick={redo} disabled={disabled || !can_redo || !editor} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><IconMdiRedo /></button>
  </div>

  {#if in_table}
    <div class="toolbar table-toolbar">
      <button type="button" onclick={add_row_after} disabled={disabled || !editor} title="Add row below" aria-label="Add row below"><IconMdiTableRowPlusAfter /></button>
      <button type="button" onclick={delete_row} disabled={disabled || !editor} title="Delete row" aria-label="Delete row"><IconMdiTableRowRemove /></button>
      <button type="button" onclick={add_column_after} disabled={disabled || !editor} title="Add column right" aria-label="Add column right"><IconMdiTableColumnPlusAfter /></button>
      <button type="button" onclick={delete_column} disabled={disabled || !editor} title="Delete column" aria-label="Delete column"><IconMdiTableColumnRemove /></button>
      <span class="separator"></span>
      <button type="button" onclick={toggle_header_row} disabled={disabled || !editor} title="Toggle header row" aria-label="Toggle header row"><IconMdiTableHeadersEye /></button>
      <button type="button" onclick={toggle_header_column} disabled={disabled || !editor} title="Toggle header column" aria-label="Toggle header column"><IconMdiTableColumn /></button>
      <button type="button" onclick={merge_cells} disabled={disabled || !editor || !can_merge_cells} title="Merge cells" aria-label="Merge cells"><IconMdiTableMergeCells /></button>
      <button type="button" onclick={split_cell} disabled={disabled || !editor || !can_split_cell} title="Split cell" aria-label="Split cell"><IconMdiTableSplitCell /></button>
      <span class="separator"></span>
      <button type="button" onclick={delete_table} disabled={disabled || !editor} title="Delete table" aria-label="Delete table"><IconMdiTableRemove /></button>
    </div>
  {/if}

  <div bind:this={element} class="editor-mount"></div>
</div>

<style>
  .markdown-editor {
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--background);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .markdown-editor.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.125rem;
    padding: 0.25rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .toolbar button {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color);
    padding: 0.25rem;
    border-radius: 0.25rem;
    cursor: pointer;
    width: 1.75rem;
    height: 1.75rem;
    transition: background 0.15s ease;
  }

  .toolbar button:hover:not(:disabled) {
    background: color-mix(in srgb, transparent, var(--color) 8%);
  }

  .toolbar button.active {
    background: color-mix(in srgb, transparent, var(--primary) 18%);
    color: var(--primary);
  }

  .toolbar button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .table-toolbar {
    background: color-mix(in srgb, var(--primary) 8%, var(--surface));
  }

  .separator {
    width: 1px;
    height: 1rem;
    background: var(--border-color);
    margin: 0 0.25rem;
  }

  .editor-mount {
    flex: 1;
    overflow-y: auto;
    color: var(--color);
  }

  :global(.markdown-editor .ProseMirror) {
    padding: 0.75rem 1rem;
    min-height: 8rem;
    outline: none;
  }

  :global(.markdown-editor .ProseMirror img) {
    max-width: 100%;
  }

  :global(.markdown-editor .ProseMirror table) {
    display: table;
    border-collapse: collapse;
    width: 100%;
    table-layout: fixed;
    margin: 2em 0;
  }

  :global(.markdown-editor .ProseMirror td),
  :global(.markdown-editor .ProseMirror th) {
    border: 1px solid var(--border-color);
    padding: 0.25rem 0.5rem;
    vertical-align: top;
    position: relative;
  }

  :global(.markdown-editor .ProseMirror th) {
    font-weight: 600;
    background: var(--surface);
  }

  :global(.markdown-editor .ProseMirror .selectedCell::after) {
    content: '';
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--primary) 18%, transparent);
    pointer-events: none;
  }

  :global(.markdown-editor .ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    color: var(--color-secondary);
    pointer-events: none;
    float: left;
    height: 0;
  }
</style>

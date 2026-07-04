<script lang="ts">
  import type { Editor } from '@tiptap/core'
  import IconMdiFormatBold from '~icons/mdi/format-bold'
  import IconMdiFormatHeader1 from '~icons/mdi/format-header-1'
  import IconMdiFormatHeader2 from '~icons/mdi/format-header-2'
  import IconMdiFormatHeader3 from '~icons/mdi/format-header-3'
  import IconMdiFormatItalic from '~icons/mdi/format-italic'
  import IconMdiFormatListBulleted from '~icons/mdi/format-list-bulleted'
  import IconMdiFormatListNumbered from '~icons/mdi/format-list-numbered'
  import IconMdiFormatQuoteClose from '~icons/mdi/format-quote-close'
  import IconMdiLinkVariant from '~icons/mdi/link-variant'
  import IconMdiRedo from '~icons/mdi/redo'
  import IconMdiUndo from '~icons/mdi/undo'
  import { onDestroy, onMount } from 'svelte'
  import { should_autolink } from '$lib/utils/should-autolink'

  type ToolbarPreset = 'email' | 'document' | 'none'

  interface Props {
    /** HTML content (bindable for parent-driven resets, e.g. clearing after send). */
    value?: string
    /** Fires on every content change. HTML is the live editor output. */
    on_change?: (html: string) => void
    /** Empty-state hint text. */
    placeholder?: string
    /** Visually + behaviorally disable the editor. */
    disabled?: boolean
    /** Toolbar preset — `email` (bold/italic/link/lists) is the default; `document`
     *  adds headings/blockquote/code-block/horizontal-rule for the document
     *  editor; `none` hides the toolbar entirely. */
    toolbar?: ToolbarPreset
    /**
     * Forwarded keydown — fires BEFORE ProseMirror processes the key. Call
     * `event.preventDefault()` in the handler and we'll also signal to ProseMirror
     * that the key was handled (so e.g. Ctrl+Enter can submit the form instead of
     * inserting a hard-break). The current default keymap is suppressed for
     * Ctrl/Cmd+Enter automatically because that combination is reserved for
     * "submit" in every composer that uses this.
     */
    on_keydown?: (event: KeyboardEvent) => void
    /**
     * Clipboard paste — fires before ProseMirror handles the paste. Call
     * `event.preventDefault()` when the image is consumed as an attachment
     * instead of inline content.
     */
    on_paste?: (event: ClipboardEvent) => void
    /** Extra classes on the outer wrapper. */
    class?: string
    /** Focus the editor after mount. */
    autofocus?: boolean
  }

  let {
    value = $bindable(''),
    on_change,
    placeholder = 'Write something…',
    disabled = false,
    toolbar = 'email',
    on_keydown,
    on_paste,
    class: classes = '',
    autofocus = false,
  }: Props = $props()

  // $state.raw — Svelte 5's deep proxying would break TipTap's internal class
  // instance (it stores ProseMirror state in private fields the proxy doesn't
  // see through). The reference change still triggers reactivity.
  let editor: Editor | null = $state.raw(null)
  let element: HTMLDivElement | undefined = $state()
  /** Bumped on every editor transaction to retrigger derived toolbar state. */
  let tick = $state(0)
  let suppressing_update = false
  /**
   * The last `value` we observed externally (either from the initial mount or
   * a parent-driven reset). Used by the sync effect to distinguish "value
   * changed externally → sync to editor" from "value changed because the
   * editor just emitted onUpdate → already in sync". Without this guard, the
   * mismatch between an empty string `value` and TipTap's normalized empty-doc
   * HTML (`<p></p>`) would re-fire the sync effect every render.
   */
  let last_external_value: string | null = null

  onMount(() => {
    let local_editor: Editor | null = null
    let cancelled = false;

    (async () => {
      const [{ Editor: TiptapEditor }, { default: StarterKit }, { Placeholder }] = await Promise.all([
        import('@tiptap/core'),
        import('@tiptap/starter-kit'),
        import('@tiptap/extension-placeholder'),
      ])
      if (cancelled || !element)
        return

      // Seed before construction — the editor is mounted with `content: value`,
      // so the initial value is already in sync. The first effect run sees
      // `value === last_external_value` and short-circuits cleanly.
      last_external_value = value
      local_editor = new TiptapEditor({
        element,
        extensions: [
          StarterKit.configure({
            // Trim down for the email preset — keep core marks, drop block-level
            // chrome that's noisy/unsafe inside an email body. Document preset
            // gets everything StarterKit ships with.
            heading: toolbar === 'email' ? false : { levels: [1, 2, 3] },
            codeBlock: toolbar === 'email' ? false : undefined,
            horizontalRule: toolbar === 'email' ? false : undefined,
            blockquote: toolbar === 'email' ? false : undefined,
            // Don't let linkify autolink bare filenames/version strings — `.zip`,
            // `.mov`, `.app`, etc. are real gTLDs, so `foo-2026.zip` was becoming
            // `http://foo-2026.zip`. Only explicit URLs / `www.` hosts autolink.
            link: { shouldAutoLink: should_autolink },
          }),
          Placeholder.configure({ placeholder }),
        ],
        content: value,
        autofocus,
        editable: !disabled,
        onUpdate: ({ editor: ed }) => {
          if (suppressing_update)
            return
          const html = ed.getHTML()
          // Mark this html as the latest "external" value too, so the sync
          // effect (triggered by `value = html` below) doesn't try to push it
          // back into the editor.
          last_external_value = html
          value = html
          on_change?.(html)
        },
        onTransaction: () => {
          tick++
        },
        editorProps: {
          attributes: {
            class: 'rich-text-editor-content outline-none',
          },
          handleKeyDown: (_view, event) => {
            on_keydown?.(event)
            // If the consumer called preventDefault, also stop ProseMirror's
            // own handling (default Ctrl+Enter → hardBreak, etc.).
            return event.defaultPrevented
          },
          handlePaste: (_view, event) => {
            on_paste?.(event)
            return event.defaultPrevented
          },
        },
      })
      editor = local_editor
    })()

    return () => {
      cancelled = true
      local_editor?.destroy()
    }
  })

  onDestroy(() => {
    editor?.destroy()
  })

  // Sync external value resets (parent clears after send, loads draft, etc.).
  // Short-circuits on the value we last either received from the editor
  // (via onUpdate) or pushed into the editor here — that's "already in sync"
  // and skipping breaks the otherwise-tight loop on empty-doc normalization
  // ('' from parent vs '<p></p>' from `editor.getHTML()`).
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
  function set_heading(level: 1 | 2 | 3) { editor?.chain().focus().toggleHeading({ level }).run() }
  function undo() { editor?.chain().focus().undo().run() }
  function redo() { editor?.chain().focus().redo().run() }

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

  // Reactive toolbar state — `tick` is read inside each derived so that the
  // value re-evaluates on every editor transaction (TipTap's `onTransaction`
  // bumps tick). `void tick` makes the dependency explicit without producing
  // a usable value in the expression.
  const bold_active = $derived.by(() => { void tick; return editor?.isActive('bold') ?? false })
  const italic_active = $derived.by(() => { void tick; return editor?.isActive('italic') ?? false })
  const link_active = $derived.by(() => { void tick; return editor?.isActive('link') ?? false })
  const bullet_list_active = $derived.by(() => { void tick; return editor?.isActive('bulletList') ?? false })
  const ordered_list_active = $derived.by(() => { void tick; return editor?.isActive('orderedList') ?? false })
  const blockquote_active = $derived.by(() => { void tick; return editor?.isActive('blockquote') ?? false })
  const heading_1_active = $derived.by(() => { void tick; return editor?.isActive('heading', { level: 1 }) ?? false })
  const heading_2_active = $derived.by(() => { void tick; return editor?.isActive('heading', { level: 2 }) ?? false })
  const heading_3_active = $derived.by(() => { void tick; return editor?.isActive('heading', { level: 3 }) ?? false })
  const can_undo = $derived.by(() => { void tick; return editor?.can().undo() ?? false })
  const can_redo = $derived.by(() => { void tick; return editor?.can().redo() ?? false })
</script>

<div class={['rich-text-editor', classes]} class:disabled>
  {#if toolbar === 'email'}
    <div class="toolbar">
      <button type="button" onclick={toggle_bold} class:active={bold_active} disabled={disabled || !editor} title="Bold (Ctrl+B)" aria-label="Bold">
        <IconMdiFormatBold />
      </button>
      <button type="button" onclick={toggle_italic} class:active={italic_active} disabled={disabled || !editor} title="Italic (Ctrl+I)" aria-label="Italic">
        <IconMdiFormatItalic />
      </button>
      <button type="button" onclick={toggle_link} class:active={link_active} disabled={disabled || !editor} title="Link" aria-label="Link">
        <IconMdiLinkVariant />
      </button>
      <span class="separator"></span>
      <button type="button" onclick={toggle_bullet_list} class:active={bullet_list_active} disabled={disabled || !editor} title="Bullet list" aria-label="Bullet list">
        <IconMdiFormatListBulleted />
      </button>
      <button type="button" onclick={toggle_ordered_list} class:active={ordered_list_active} disabled={disabled || !editor} title="Numbered list" aria-label="Numbered list">
        <IconMdiFormatListNumbered />
      </button>
      <span class="separator"></span>
      <button type="button" onclick={undo} disabled={disabled || !can_undo || !editor} title="Undo (Ctrl+Z)" aria-label="Undo">
        <IconMdiUndo />
      </button>
      <button type="button" onclick={redo} disabled={disabled || !can_redo || !editor} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
        <IconMdiRedo />
      </button>
    </div>
  {:else if toolbar === 'document'}
    <div class="toolbar">
      <button type="button" onclick={() => set_heading(1)} class:active={heading_1_active} disabled={disabled || !editor} title="Heading 1" aria-label="Heading 1">
        <IconMdiFormatHeader1 />
      </button>
      <button type="button" onclick={() => set_heading(2)} class:active={heading_2_active} disabled={disabled || !editor} title="Heading 2" aria-label="Heading 2">
        <IconMdiFormatHeader2 />
      </button>
      <button type="button" onclick={() => set_heading(3)} class:active={heading_3_active} disabled={disabled || !editor} title="Heading 3" aria-label="Heading 3">
        <IconMdiFormatHeader3 />
      </button>
      <span class="separator"></span>
      <button type="button" onclick={toggle_bold} class:active={bold_active} disabled={disabled || !editor} title="Bold (Ctrl+B)" aria-label="Bold">
        <IconMdiFormatBold />
      </button>
      <button type="button" onclick={toggle_italic} class:active={italic_active} disabled={disabled || !editor} title="Italic (Ctrl+I)" aria-label="Italic">
        <IconMdiFormatItalic />
      </button>
      <button type="button" onclick={toggle_link} class:active={link_active} disabled={disabled || !editor} title="Link" aria-label="Link">
        <IconMdiLinkVariant />
      </button>
      <span class="separator"></span>
      <button type="button" onclick={toggle_bullet_list} class:active={bullet_list_active} disabled={disabled || !editor} title="Bullet list" aria-label="Bullet list">
        <IconMdiFormatListBulleted />
      </button>
      <button type="button" onclick={toggle_ordered_list} class:active={ordered_list_active} disabled={disabled || !editor} title="Numbered list" aria-label="Numbered list">
        <IconMdiFormatListNumbered />
      </button>
      <button type="button" onclick={toggle_blockquote} class:active={blockquote_active} disabled={disabled || !editor} title="Quote" aria-label="Quote">
        <IconMdiFormatQuoteClose />
      </button>
      <span class="separator"></span>
      <button type="button" onclick={undo} disabled={disabled || !can_undo || !editor} title="Undo (Ctrl+Z)" aria-label="Undo">
        <IconMdiUndo />
      </button>
      <button type="button" onclick={redo} disabled={disabled || !can_redo || !editor} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
        <IconMdiRedo />
      </button>
    </div>
  {/if}

  <div bind:this={element} class="editor-mount"></div>
</div>

<style>
  .rich-text-editor {
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--background);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .rich-text-editor.disabled {
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

  .separator {
    width: 1px;
    height: 1rem;
    background: var(--border-color);
    margin: 0 0.25rem;
  }

  .editor-mount {
    flex: 1;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--color);
    min-height: 6rem;
  }

  /* ProseMirror's contenteditable lives inside .editor-mount once mounted.
     :global() because TipTap injects it post-init outside this scope. */
  :global(.rich-text-editor .ProseMirror) {
    padding: 0.5rem 0.75rem;
    min-height: 6rem;
    outline: none;
  }

  :global(.rich-text-editor .ProseMirror > * + *) {
    margin-top: 0.5rem;
  }

  :global(.rich-text-editor .ProseMirror p) {
    margin: 0;
  }

  /* Consecutive paragraphs get a full email-style gap (matches the 14px the
     sent email uses in `text_to_safe_html`) so multi-paragraph bodies — e.g. a
     triage "Use draft" reply — read as distinct paragraphs, not one tight block.
     The compact 0.5rem above still governs paragraph↔list/heading spacing. */
  :global(.rich-text-editor .ProseMirror p + p) {
    margin-top: 1em;
  }

  :global(.rich-text-editor .ProseMirror ul) {
    padding-left: 1.25rem;
    margin: 0;
    list-style: disc;
  }
  :global(.rich-text-editor .ProseMirror ol) {
    padding-left: 1.5rem;
    margin: 0;
    list-style: decimal;
  }
  :global(.rich-text-editor .ProseMirror li > p) {
    margin: 0;
  }

  :global(.rich-text-editor .ProseMirror h1) {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }
  :global(.rich-text-editor .ProseMirror h2) {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }
  :global(.rich-text-editor .ProseMirror h3) {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }
  :global(.rich-text-editor .ProseMirror blockquote) {
    border-left: 3px solid var(--border-color);
    padding-left: 0.75rem;
    color: var(--color-secondary);
    margin: 0;
  }

  :global(.rich-text-editor .ProseMirror a) {
    color: var(--primary);
    text-decoration: underline;
    cursor: pointer;
  }

  /* Empty-state placeholder. TipTap's Placeholder extension adds the data
     attribute + the is-editor-empty class; this is the canonical CSS for it. */
  :global(.rich-text-editor .ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    color: var(--color-secondary);
    pointer-events: none;
    float: left;
    height: 0;
  }
</style>

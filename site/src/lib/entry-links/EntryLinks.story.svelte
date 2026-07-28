<script lang="ts">
  import { build_entry_link_index } from './exact-lexeme-index'
  import { link_entry_mentions } from './link-entry-mentions'
  import type { EntryMentionClick } from './link-entry-mentions'
  import EntryMentionPopover from './EntryMentionPopover.svelte'

  /**
   * Story fixture ONLY — the popover anchors to a live DOM node and the linking
   * pass needs rendered prose, neither of which a plain props story can supply.
   * Renders authored prose exactly the way the grammar page does, so screenshots
   * cover the link affordance and the card together.
   */

  interface Props {
    html: string
    entries: { id: string, lexeme: Record<string, string> }[]
    /** Open this word's popover on mount, so a screenshot catches the card. */
    open_form?: string
  }

  const { html, entries, open_form }: Props = $props()

  const index = $derived(build_entry_link_index(entries))
  let open_mention = $state<EntryMentionClick | null>(null)

  // Two frames: one for the linking pass, one for the marks it created.
  function auto_open(root: HTMLElement) {
    if (!open_form) return
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const mark = [...root.querySelectorAll<HTMLElement>('.entry-mention')]
        .find(element => element.textContent === open_form)
      mark?.click()
    }))
  }
</script>

<div
  class="body tw-prose"
  {@attach link_entry_mentions({ index, html, on_click: detail => open_mention = detail })}
  {@attach auto_open}>
  {@html html}
</div>

{#if open_mention}
  <EntryMentionPopover
    entry_ids={open_mention.entry_ids}
    form={open_mention.form}
    anchor={open_mention.anchor}
    on_close={() => open_mention = null} />
{/if}

<style>
  .body {
    padding: 1rem;
  }

  .body :global(.entry-mention) {
    display: inline;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
    border-bottom: 1px dotted color-mix(in srgb, var(--primary) 55%, transparent);
  }

  .body :global(.entry-mention:hover) {
    border-bottom-color: var(--primary);
    color: var(--primary);
  }
</style>

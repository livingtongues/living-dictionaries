<script lang="ts">
  import type { TocEntry } from './grammar-toc'
  import { scroll_to_anchor } from './scroll-spy.svelte'

  /**
   * The table-of-contents list itself — shared verbatim by the desktop right
   * rail and the mobile overlay. Entries are real anchors so middle-click /
   * copy-link keep working; the click handler only upgrades the jump to a
   * smooth scroll.
   */

  interface Props {
    entries: TocEntry[]
    /** Fired after a jump — the mobile overlay uses it to close itself. */
    on_navigate?: () => void
    /** Keep the active entry visible inside the rail's own scrollbar. */
    follow_active?: boolean
  }

  const { entries, on_navigate, follow_active = false }: Props = $props()

  let nav: HTMLElement | undefined = $state()

  function jump(event: MouseEvent, dom_id: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    scroll_to_anchor(dom_id)
    on_navigate?.()
  }

  /** Nearest ancestor with its own overflow — the rail, not the document. */
  function scroll_parent(element: HTMLElement): HTMLElement | null {
    let node = element.parentElement
    while (node) {
      if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY))
        return node
      node = node.parentElement
    }
    return null
  }

  // A 19-chapter TOC outgrows the rail; nudge (never page-scroll) the active
  // entry back into view as the reader moves through the document.
  $effect(() => {
    const active = entries.find(entry => entry.is_active)
    if (!follow_active || !active || !nav) return
    const link = nav.querySelector<HTMLElement>(`[data-toc-id="${CSS.escape(active.id)}"]`)
    const scroller = link && scroll_parent(link)
    if (!link || !scroller) return
    const scroller_box = scroller.getBoundingClientRect()
    const link_box = link.getBoundingClientRect()
    if (link_box.top < scroller_box.top)
      scroller.scrollTop += link_box.top - scroller_box.top - 12
    else if (link_box.bottom > scroller_box.bottom)
      scroller.scrollTop += link_box.bottom - scroller_box.bottom + 12
  })
</script>

<nav class="toc" bind:this={nav}>
  <ul>
    {#each entries as entry (entry.id)}
      <li>
        <a
          href={`#${entry.dom_id}`}
          data-toc-id={entry.id}
          class="link"
          class:active={entry.is_active}
          class:child={entry.depth === 1}
          onclick={event => jump(event, entry.dom_id)}>
          {#if entry.number}<span class="number">{entry.number}</span>{/if}
          <span class="label">{entry.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  ul {
    display: flex;
    flex-direction: column;
    gap: 0.0625rem;
  }

  .link {
    display: flex;
    gap: 0.4375rem;
    padding: 0.3125rem 0.5rem;
    border-radius: 0.375rem;
    border-left: 2px solid transparent;
    color: var(--color-secondary);
    text-decoration: none;
    font-size: 0.8125rem;
    line-height: 1.35;
    transition: background var(--transition-time), color var(--transition-time);
  }

  .link:hover {
    background: var(--surface);
    color: var(--color);
  }

  .link.child {
    padding-left: 1.375rem;
    font-size: 0.78125rem;
  }

  .link.active {
    color: var(--primary);
    border-left-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 8%, transparent);
    font-weight: 600;
  }

  .number {
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    opacity: 0.75;
  }

  .label {
    min-width: 0;
  }
</style>

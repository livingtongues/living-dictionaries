<script lang="ts">
  import type { Snippet } from 'svelte'
  import { portal } from '$lib/utils/portal'

  interface Props {
    /** Element the popover is anchored to (the tapped word/button). */
    anchor: HTMLElement
    on_close: () => void
    children: Snippet
    /** Above Slideover/Modal (60) — callers should CLOSE the popover before opening a Modal. */
    zIndex?: number
    max_width?: string
  }

  const { anchor, on_close, children, zIndex = 70, max_width = '20rem' }: Props = $props()

  const MOBILE_BREAKPOINT = 640
  const VIEWPORT_PADDING = 8

  let card = $state<HTMLElement | null>(null)
  let is_mobile = $state(false)
  let position = $state<{ top: number, left: number } | null>(null)

  // Position after mount (needs the card's rendered size), reposition on
  // resize/scroll. Mobile renders a bottom sheet instead — no anchoring math.
  $effect(() => {
    if (!card) return
    function place() {
      is_mobile = window.innerWidth < MOBILE_BREAKPOINT
      if (is_mobile || !card) {
        position = null
        return
      }
      const anchor_rect = anchor.getBoundingClientRect()
      const card_rect = card.getBoundingClientRect()
      let top = anchor_rect.bottom + 6
      if (top + card_rect.height > window.innerHeight - VIEWPORT_PADDING && anchor_rect.top - card_rect.height - 6 > VIEWPORT_PADDING)
        top = anchor_rect.top - card_rect.height - 6
      const left = Math.min(
        Math.max(VIEWPORT_PADDING, anchor_rect.left + anchor_rect.width / 2 - card_rect.width / 2),
        window.innerWidth - card_rect.width - VIEWPORT_PADDING,
      )
      position = { top, left }
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  })

  function on_keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      on_close()
    }
  }
</script>

<svelte:window onkeydown={on_keydown} />

<div use:portal class="popover-layer" style="z-index: {zIndex};">
  <button type="button" class="backdrop" class:dimmed={is_mobile} aria-label="Close" onclick={on_close}></button>
  <div
    bind:this={card}
    class="card"
    class:sheet={is_mobile}
    role="dialog"
    style:max-width={is_mobile ? undefined : max_width}
    style:top={position ? `${position.top}px` : undefined}
    style:left={position ? `${position.left}px` : undefined}
    style:visibility={is_mobile || position ? 'visible' : 'hidden'}>
    {@render children()}
  </div>
</div>

<style>
  .popover-layer {
    position: fixed;
    inset: 0;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: default;
  }

  .backdrop.dimmed {
    background: rgb(0 0 0 / 0.4);
  }

  .card {
    position: fixed;
    background: var(--background);
    color: var(--color);
    border: 1px solid var(--border-color);
    border-radius: 0.625rem;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
    padding: 0.75rem;
    overflow-y: auto;
    max-height: min(70vh, 26rem);
  }

  .card.sheet {
    inset: auto 0 0 0;
    border-radius: 1rem 1rem 0 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    max-height: 70vh;
    padding: 1rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }
</style>

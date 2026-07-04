<script lang="ts">
  import IconMdiClose from '~icons/mdi/close'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { portal } from '$lib/svelte-pieces/portal'

  interface Props {
    src: string
    alt?: string
    on_close: () => void
  }

  const { src, alt = '', on_close }: Props = $props()

  onMount(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  })
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') on_close() }} />

<div use:portal class="lightbox-root" transition:fade={{ duration: 150 }}>
  <button type="button" class="lightbox-backdrop" aria-label="Close viewer" onclick={on_close}></button>
  <img class="lightbox-image" {src} {alt} />
  <button type="button" class="lightbox-close" aria-label="Close" onclick={on_close}>
    <IconMdiClose />
  </button>
</div>

<style>
  .lightbox-root {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .lightbox-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgb(0 0 0 / 0.85);
    cursor: zoom-out;
  }
  .lightbox-image {
    position: relative;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 0.375rem;
    box-shadow: 0 10px 40px rgb(0 0 0 / 0.5);
    pointer-events: none;
  }
  .lightbox-close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 2.25rem;
    height: 2.25rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.5);
    color: #fff;
    cursor: pointer;
    font-size: 1.25rem;
  }
  .lightbox-close:hover {
    background: rgb(0 0 0 / 0.75);
  }
</style>

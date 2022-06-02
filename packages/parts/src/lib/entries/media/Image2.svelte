<script lang="ts">
  import { spring } from 'svelte/motion';
  export let gcs: string;
  export let length: number;
  export let dimensionType: 'square' | 'width' | 'height' = 'width';

  let imageEl: HTMLImageElement;

  let ww = 0;
  let wh = 0;
  let scale = spring(1);
  let opacity = spring(0, { stiffness: 0.2, damping: 1 });
  let viewing = false;

  function handle_click() {
    if (imageEl === null) return;
    const styles = window.getComputedStyle(imageEl);
    const top_offset = parseInt(styles.getPropertyValue('margin-top'));
    const left_offset = parseInt(styles.getPropertyValue('margin-left'));
    const { left, right, top, bottom, width } = imageEl.getBoundingClientRect();
    let pos = [left < ww - right ? 0 : 100, top < wh - bottom ? 0 : 100];
    // active_el.index = i;
    // active_el.left = `${left - left_offset}px`;
    // active_el.top = `${top - top_offset}px`;
    // active_el.origin = `${pos[0]}% ${pos[1]}%`;
    viewing = !viewing;
    requestAnimationFrame(() => {
      scale.set((ww - 2 - left_offset * 2) / width);
      opacity.set(0.95);
    });
  }

  async function clear() {
    requestAnimationFrame(async () => {
      await Promise.all([scale.set(1), opacity.set(0)]);
      // active_el = {
      // 	index: -1,
      // 	left: '0',
      // 	top: '0',
      // 	origin: '0 0'
      // };
      viewing = false;
    });
  }

  $: src = `https://lh3.googleusercontent.com/${gcs}=${
    dimensionType === 'square'
      ? `s${length}-p`
      : dimensionType === 'width'
      ? `w${length}`
      : dimensionType === 'height'
      ? `h${length}`
      : 's0'
  }`;
</script>

<img
  bind:this={imageEl}
  on:click={handle_click}
  class="h-full w-full object-cover cursor-pointer"
  alt=""
  {src} />

<div
  class="overlay"
  on:click={clear}
  style:opacity={$opacity}
  style:pointer-events={viewing ? 'auto' : 'none'}
  bind:clientWidth={ww}
  bind:clientHeight={wh} />

<style>
  .overlay {
    position: fixed;
    z-index: 12;
    top: -1px;
    left: -1px;
    right: -1px;
    bottom: -1px;
    background: black;
    margin: auto;
    pointer-events: none;
  }
</style>

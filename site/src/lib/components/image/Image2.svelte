<script lang="ts">
  // learning from https://github.com/pngwn/peng-move/blob/main/src/lib/Animal.svelte
  import { spring } from 'svelte/motion'
  import { image_src } from '$lib/utils/media-url'

  interface Props {
    gcs: string
    length: number
    dimensionType?: 'square' | 'width' | 'height'
  }

  const { gcs, length, dimensionType = 'width' }: Props = $props()

  let imageEl: HTMLImageElement = $state()

  let ww = $state(0)
  let wh = $state(0)
  const scale = spring(1)
  const opacity = spring(0, { stiffness: 0.2, damping: 1 })
  let viewing = $state(false)

  function handle_click() {
    if (imageEl === null) return
    const styles = window.getComputedStyle(imageEl)
    // const top_offset = parseInt(styles.getPropertyValue('margin-top'));
    const left_offset = Number.parseInt(styles.getPropertyValue('margin-left'))
    const { left, right, top, bottom, width } = imageEl.getBoundingClientRect()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const pos = [left < ww - right ? 0 : 100, top < wh - bottom ? 0 : 100]
    // active_el.index = i;
    // active_el.left = `${left - left_offset}px`;
    // active_el.top = `${top - top_offset}px`;
    // active_el.origin = `${pos[0]}% ${pos[1]}%`;
    viewing = !viewing
    requestAnimationFrame(() => {
      scale.set((ww - 2 - left_offset * 2) / width)
      opacity.set(0.95)
    })
  }

  function clear() {
    requestAnimationFrame(async () => {
      await Promise.all([scale.set(1), opacity.set(0)])
      // active_el = {
      //   index: -1,
      //   left: '0',
      //   top: '0',
      //   origin: '0 0'
      // };
      viewing = false
    })
  }

  const src = $derived(image_src(gcs, dimensionType === 'square'
    ? `s${length}-p`
    : dimensionType === 'width'
    ? `w${length}`
    : dimensionType === 'height'
    ? `h${length}`
    : 's0'))
</script>

<img
  bind:this={imageEl}
  onclick={handle_click}
  style="height: 100%; width: 100%; object-fit: cover; cursor: pointer"
  alt=""
  {src} />

<div
  class="overlay"
  onclick={clear}
  style:opacity={$opacity}
  style:pointer-events={viewing ? 'auto' : 'none'}
  bind:clientWidth={ww}
  bind:clientHeight={wh}></div>

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

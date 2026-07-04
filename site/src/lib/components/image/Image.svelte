<script lang="ts">
  import { crossfade, scale } from 'svelte/transition'
  import Button from '$lib/components/ui/Button.svelte'
  import { page } from '$app/state'
  import { image_src } from '$lib/helpers/media'
  import IconGgSpinner from '~icons/gg/spinner'
  import IconTablerAi from '~icons/tabler/ai'
  import IconFaSolidTimes from '~icons/fa-solid/times'
  import IconFaTrashO from '~icons/fa/trash-o'

  interface Props {
    title: string
    gcs: string
    can_edit?: boolean
    square?: number
    width?: number
    height?: number
    photo_source?: string
    photographer?: string
    page_context?: string
    on_delete_image: () => Promise<any>
  }

  const {
    title,
    gcs,
    can_edit = false,
    square = undefined,
    width = undefined,
    height = undefined,
    photo_source = undefined,
    photographer = undefined,
    page_context = undefined,
    on_delete_image,
  }: Props = $props()

  const [send, receive] = crossfade({
    duration: 200,
    fallback: scale,
  })

  let windowWidth: number = $state()
  let loading = $state(false)
  let viewing = $state(false)

  const isDesktop = $derived(windowWidth >= 768)
  const fullscreenSource = $derived(image_src(gcs, `w${isDesktop ? windowWidth - 24 : windowWidth}`))

  function load() {
    const timeout = setTimeout(() => (loading = true), 100)
    const img = new Image()

    img.onload = () => {
      clearTimeout(timeout)
      loading = false
      viewing = true
    }

    img.src = fullscreenSource
  }
  const key = {}
</script>

<svelte:window
  bind:innerWidth={windowWidth}
  onkeydown={(e) => {
    if (e.key === 'Escape') viewing = false
  }} />

{#if !viewing}
  <div class="image-wrap">
    <img
      class="thumb"
      onclick={load}
      in:receive|local={{ key }}
      out:send|local={{ key }}
      alt=""
      src={image_src(gcs, square
        ? `s${square}-p`
        : width
        ? `w${width}`
        : height
        ? `h${height}`
        : 's0')} />
    {#if loading}
      <IconGgSpinner class="icon-inline spinner" />
    {:else if photographer === 'AI'}
      <IconTablerAi class="icon-inline ai-badge" style="font-size: {page_context === 'gallery' ? '3.75rem' : '1.5rem'}" />
    {/if}
  </div>
{/if}

{#if viewing}
  <div
    onclick={() => viewing = false}
    class="viewer"
    in:receive={{ key }}
    out:send={{ key }}
    style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
    <div class="viewer-inner">
      <div class="viewer-header">
        <span onclick={e => e.stopPropagation()}>{title}</span>
        <IconFaSolidTimes class="icon-inline viewer-close" style="font-size: 2.5rem" />
      </div>
      {#if photographer === 'AI'}
        <div class="ai-fullscreen">
          <IconTablerAi class="icon-inline" style="font-size: 4.5rem" />
          <span style="vertical-align: sub; font-size: 1.25rem; line-height: 1.75rem">generated</span>
        </div>
      {/if}
      <img class="full-img" alt="Image of {title}" src={fullscreenSource} />
      {#if photo_source}
        <div class="caption-row">
          <span>{photo_source}</span>
          {#if photographer !== 'AI'}<span>{photographer}</span>{/if}
        </div>
      {/if}
      {#if can_edit}
        <div class="viewer-footer">
          <Button
            class="image-delete-button"
            color="red"
            form="filled"
            onclick={async (e) => {
              const confirmation = confirm(page.data.t('entry.delete_image'))
              if (confirmation) {
                e.stopPropagation()
                await on_delete_image()
              }
            }}>
            <IconFaTrashO class="icon-inline" style="margin: -1px 0 2px;" />
            {page.data.t('misc.delete')}
          </Button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .image-wrap {
    height: 100%;
    width: 100%;
    position: relative;
  }

  .thumb {
    height: 100%;
    width: 100%;
    object-fit: cover;
    cursor: pointer;
  }

  .image-wrap :global(.spinner) {
    position: absolute;
    bottom: 0.25rem;
    right: 0.25rem;
    color: #fff;
    animation: image-spin 1s linear infinite;
  }

  @keyframes image-spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }

  .image-wrap :global(.ai-badge) {
    color: #fff;
    position: absolute;
    bottom: 0.25rem;
    left: 0.25rem;
  }

  .viewer {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  @media (min-width: 768px) {
    .viewer {
      padding: 0.75rem;
    }
  }

  .viewer-inner {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .viewer-header {
    font-weight: 600;
    color: #fff;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background-color: rgb(0 0 0 / 0.25);
  }

  .viewer-header :global(.viewer-close) {
    cursor: pointer;
    opacity: 0.75;
  }

  .viewer-header :global(.viewer-close:hover) {
    opacity: 1;
  }

  .ai-fullscreen {
    position: absolute;
    bottom: 0.25rem;
    left: 2.5rem;
    color: #fff;
    z-index: 10;
  }

  .full-img {
    object-fit: contain;
    max-height: 100%;
  }

  .caption-row {
    color: #fff;
    display: flex;
    justify-content: space-between;
  }

  .viewer-footer {
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: rgb(0 0 0 / 0.25);
  }

  .viewer-footer :global(.image-delete-button) {
    margin-left: auto;
  }
</style>

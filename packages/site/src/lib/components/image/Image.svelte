<script lang="ts">
  import { createBubbler, stopPropagation } from 'svelte/legacy'

  const bubble = createBubbler()
  import { page } from '$app/stores'
  import { Button } from '$lib/svelte-pieces'
  import { crossfade, scale } from 'svelte/transition'

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

  let {
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

  let isDesktop = $derived(windowWidth >= 768)
  let fullscreenSource = $derived(`https://lh3.googleusercontent.com/${gcs}=w${isDesktop ? windowWidth - 24 : windowWidth}`)

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
  <div class="h-full w-full relative">
    <img
      class="h-full w-full object-cover cursor-pointer"
      onclick={load}
      in:receive|local={{ key }}
      out:send|local={{ key }}
      alt=""
      src="https://lh3.googleusercontent.com/{gcs}={square
        ? `s${square}-p`
        : width
        ? `w${width}`
        : height
        ? `h${height}`
        : 's0'}" />
    {#if loading}
      <span class="i-gg-spinner animate-spin absolute bottom-1 right-1 text-white"></span>
    {:else if photographer === 'AI'}
      <span class="i-tabler:ai text-white absolute bottom-1 left-1 {page_context === 'gallery' ? 'text-6xl' : 'text-2xl'}"></span>
    {/if}
  </div>
{/if}

{#if viewing}
  <div
    onclick={() => viewing = false}
    class="fixed inset-0 md:p-3 flex flex-col items-center justify-center"
    in:receive={{ key }}
    out:send={{ key }}
    style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
    <div class="h-full flex flex-col justify-center">
      <div
        class="font-semibold text-white p-4 flex justify-between items-center
          absolute top-0 inset-x-0 bg-opacity-25 bg-black">
        <span onclick={stopPropagation(bubble('click'))}>{title}</span>
        <span class="i-fa-solid-times p-3 cursor-pointer opacity-75 hover:opacity-100"></span>
      </div>
      {#if photographer === 'AI'}
        <div class="absolute bottom-1 left-10 text-white z-10">
          <span class="i-tabler:ai text-7xl"></span>
          <span class="align-sub text-xl">generated</span>
        </div>
      {/if}
      <img class="object-contain max-h-full" alt="Image of {title}" src={fullscreenSource} />
      {#if photo_source}
        <div class="text-white flex justify-between">
          <span>{photo_source}</span>
          {#if photographer !== 'AI'}<span>{photographer}</span>{/if}
        </div>
      {/if}
      {#if can_edit}
        <div
          class="p-4 flex justify-between
            items-center absolute bottom-0 inset-x-0 bg-opacity-25 bg-black">
          <Button
            class="ml-auto"
            color="red"
            form="filled"
            onclick={async (e) => {
              const confirmation = confirm($page.data.t('entry.delete_image'))
              if (confirmation) {
                e.stopPropagation()
                await on_delete_image()
              }
            }}>
            <span class="i-fa-trash-o" style="margin: -1px 0 2px;"></span>
            {$page.data.t('misc.delete')}
          </Button>
        </div>
      {/if}
    </div>
  </div>
{/if}

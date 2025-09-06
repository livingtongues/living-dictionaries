<script lang="ts">
  import { crossfade, scale } from 'svelte/transition'
  import { Button } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let title: string
  export let gcs: string
  export let can_edit = false
  export let square: number = undefined
  export let width: number = undefined
  export let height: number = undefined
  export let on_delete_image: () => Promise<any>

  const [send, receive] = crossfade({
    duration: 200,
    fallback: scale,
  })

  let windowWidth: number
  let loading = false
  let viewing = false

  $: isDesktop = windowWidth >= 768
  $: fullscreenSource = `https://lh3.googleusercontent.com/${gcs}=w${isDesktop ? windowWidth - 24 : windowWidth}`

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
  on:keydown={(e) => {
    if (e.key === 'Escape') viewing = false
  }} />

{#if !viewing}
  <div class="h-full w-full relative">
    <img
      class="h-full w-full object-cover cursor-pointer"
      on:click={load}
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
      <span class="i-gg-spinner animate-spin absolute bottom-1 right-1 text-white" />
    {/if}
  </div>
{/if}

{#if viewing}
  <div
    on:click={() => viewing = false}
    class="fixed inset-0 md:p-3 flex flex-col items-center justify-center"
    in:receive={{ key }}
    out:send={{ key }}
    style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
    <div class="h-full flex flex-col justify-center">
      <div
        class="font-semibold text-white p-4 flex justify-between items-center
          absolute top-0 inset-x-0 bg-opacity-25 bg-black">
        <span on:click|stopPropagation>{title}</span>
        <span class="i-fa-solid-times p-3 cursor-pointer opacity-75 hover:opacity-100" />
      </div>
      <img class="object-contain max-h-full" alt="Image of {title}" src={fullscreenSource} />
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
            <span class="i-fa-trash-o" style="margin: -1px 0 2px;" />
            {$page.data.t('misc.delete')}
          </Button>
        </div>
      {/if}
    </div>
  </div>
{/if}

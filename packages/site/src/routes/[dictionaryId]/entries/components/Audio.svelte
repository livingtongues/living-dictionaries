<script context="module" lang="ts">
  import { writable } from 'svelte/store'

  interface AudioState {
    current_audio: HTMLAudioElement | null
    is_playing: boolean
  }

  const audioStore = writable<AudioState>({
    current_audio: null,
    is_playing: false,
  })

  function playAudio(url: string) {
    audioStore.update((store) => {
      if (store.current_audio) {
        store.current_audio.pause()
        store.current_audio = null
      }

      const audio = new Audio(url)
      audio.play()

      audio.addEventListener('ended', () => {
        audioStore.set({ current_audio: null, is_playing: false })
      })

      return { current_audio: audio, is_playing: true }
    })
  }
</script>

<script lang="ts">
  import { ShowHide, longpress } from '$lib/svelte-pieces'
  import type { EntryData } from '@living-dictionaries/types'
  import { page } from '$app/stores'
  import { minutes_ago_in_ms } from '$lib/helpers/time'

  let { entry, context, sound_file = undefined, can_edit = false, class: class_prop = '' }: {
    entry: EntryData
    context: 'list' | 'table' | 'entry'
    sound_file?: EntryData['audios'][0]
    can_edit?: boolean
    class?: string
  } = $props()
  let { url_from_storage_path } = $derived($page.data)

  function initAudio() {
    playAudio(url_from_storage_path(sound_file.storage_path))
  }

  let playing = $derived($audioStore.is_playing && $audioStore.current_audio?.src === url_from_storage_path(sound_file?.storage_path))

  function longpress_action(node: HTMLElement, duration = 800) {
    const action = longpress(node, duration)
    node.addEventListener('longpress', initAudio)
    return {
      update: action.update,
      destroy() {
        node.removeEventListener('longpress', initAudio)
        action.destroy()
      },
    }
  }
</script>

<ShowHide let:show let:toggle>
  {#if sound_file}
    {@const updated_within_last_5_minutes = sound_file.updated_at && can_edit && new Date(sound_file.updated_at).getTime() > minutes_ago_in_ms(5)}
    <div
      class:border-b-2={updated_within_last_5_minutes}
      class="{class_prop} hover:bg-gray-200 flex flex-col items-center
        justify-center cursor-pointer select-none border-green-300"
      title={$page.data.t('audio.listen')}
      use:longpress_action={800}
      onclick={() => {
        if (can_edit)
          toggle()
        else
          initAudio()
      }}>
      {#if context === 'list'}
        <span class:text-blue-700={playing} class="i-material-symbols-hearing text-xl mt-1" />
        <div class="text-xs text-center line-clamp-1 w-full" style="overflow-wrap: break-word;">
          {$page.data.t('audio.listen')}
        </div>
      {:else if context === 'table'}
        <span class:text-blue-700={playing} class="i-material-symbols-hearing text-lg mt-1" />
      {:else if context === 'entry'}
        <span
          class:text-blue-700={playing}
          class="i-material-symbols-hearing text-lg mb-1" />
        <div class="text-center text-xs">
          {$page.data.t('audio.listen')}
          {#if can_edit}
            +
            {$page.data.t('audio.edit_audio')}
          {/if}
        </div>
      {/if}
    </div>
  {:else if can_edit}
    <div
      class="{class_prop} hover:bg-gray-300 flex flex-col items-center
        justify-center cursor-pointer select-none"
      onclick={toggle}>
      <span class="i-uil-microphone text-lg m-1" class:text-blue-800={context === 'list' || context === 'table'} />
      {#if context === 'entry'}
        <div class="text-xs">
          {$page.data.t('audio.add_audio')}
        </div>
      {/if}
    </div>
  {/if}

  {#if show}
    {#await import('$lib/components/audio/EditAudio.svelte') then { default: EditAudio }}
      <EditAudio {entry} {sound_file} on_close={toggle} />
    {/await}
  {/if}
</ShowHide>

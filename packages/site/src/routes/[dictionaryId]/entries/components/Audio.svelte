<script lang="ts">
  import { ShowHide, longpress } from 'svelte-pieces'
  import type { EntryData } from '@living-dictionaries/types'
  import { audioStore, playAudio } from './audio-store'
  import { page } from '$app/stores'
  import { minutes_ago_in_ms } from '$lib/helpers/time'

  export let entry: EntryData
  export let context: 'list' | 'table' | 'entry'
  export let sound_file: EntryData['audios'][0] = undefined
  export let can_edit = false
  $: ({ url_from_storage_path } = $page.data)

  function initAudio() {
    playAudio(url_from_storage_path(sound_file.storage_path))
  }

  $: playing = $audioStore.is_playing && $audioStore.current_audio?.src === url_from_storage_path(sound_file?.storage_path)
</script>

<ShowHide let:show let:toggle>
  {#if sound_file}
    {@const updated_within_last_5_minutes = sound_file.updated_at && can_edit && new Date(sound_file.updated_at).getTime() > minutes_ago_in_ms(5)}
    <div
      class:border-b-2={updated_within_last_5_minutes}
      class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
        justify-center cursor-pointer select-none border-green-300"
      title={$page.data.t('audio.listen')}
      use:longpress={800}
      on:longpress={() => initAudio()}
      on:click={() => {
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
      class="{$$props.class} hover:bg-gray-300 flex flex-col items-center
        justify-center cursor-pointer select-none"
      on:click={toggle}>
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

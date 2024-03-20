<script lang="ts">
  import { page } from '$app/stores';
  import { firebaseConfig } from 'sveltefirets';
  import { ShowHide, longpress } from 'svelte-pieces';
  import type { ExpandedEntry } from '@living-dictionaries/types';

  export let entry: ExpandedEntry;
  // export let sound_file: ExpandedAudio; // TODO
  export let context: 'list' | 'table' | 'entry';
  export let can_edit = false;

  $: sound_file = entry.sound_files?.[0];

  let playing = false;

  function initAudio(audioPath: string) {
    const convertedPath = audioPath.replace(/\//g, '%2F');
    const url = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${convertedPath}?alt=media`; // TODO: this conversion should be done upon receiving data from the server - it should not be the component's responsibility, then we can just use the path as is and don't need to depend on sveltefirets and don't need to lazy-load this component
    const audio = new Audio(url);
    audio.play();
    playing = true;
    audio.addEventListener('ended', () => {
      playing = false;
    });
  // TODO: unsubscribe listener
  }
</script>

<ShowHide let:show let:toggle>
  {#if sound_file}
    <div
      class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
        justify-center cursor-pointer select-none"
      title={$page.data.t('audio.listen')}
      use:longpress={800}
      on:longpress={() => initAudio(sound_file.fb_storage_path)}
      on:click={() => {
        if (can_edit)
          toggle();
        else
          initAudio(sound_file.fb_storage_path);
      }}>
      {#if context === 'list'}
        <span class:text-blue-700={playing} class="i-material-symbols-hearing text-xl mt-1" />
        <div class="text-xs text-center line-clamp-1 break-all">
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
      <EditAudio {entry} sound_file={sound_file} on:close={toggle} />
    {/await}
  {/if}
</ShowHide>

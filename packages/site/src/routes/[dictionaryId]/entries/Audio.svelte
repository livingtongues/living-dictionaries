<script lang="ts">
  import { t } from 'svelte-i18n';
  import { firebaseConfig } from 'sveltefirets';
  import { ShowHide, longpress } from 'svelte-pieces';
  import type { ExpandedEntry } from '@living-dictionaries/types';

  export let entry: ExpandedEntry;
  // export let sound_file: ExpandedAudio; // TODO
  export let minimal = false;
  export let canEdit = false;

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
      use:longpress={800}
      on:longpress={() => initAudio(sound_file.fb_storage_path)}
      on:click={() => {
        if (canEdit)
          toggle();
        else
          initAudio(sound_file.fb_storage_path);
      }}>
      <slot {playing} />
    </div>
  {:else if canEdit}
    <div
      class="{$$props.class} hover:bg-gray-300 flex flex-col items-center
        justify-center cursor-pointer select-none"
      on:click={toggle}>
      <span class="i-uil-microphone text-lg m-1 text-blue-800" />
      {#if !minimal}
        <div class="text-blue-800 text-xs">
          {$t('audio.add_audio', { default: 'Add Audio' })}
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

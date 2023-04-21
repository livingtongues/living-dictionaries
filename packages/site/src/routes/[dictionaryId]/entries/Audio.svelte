<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { IEntry } from '@living-dictionaries/types';
  import { ShowHide, longpress } from 'svelte-pieces';
  import { firebaseConfig } from 'sveltefirets';

  export let entry: IEntry;
  export let minimal = false;
  export let canEdit = false;

  let playing = false;

  function initAudio(sf: IEntry['sf']) {
    const convertedPath = sf.path.replace(/\//g, '%2F');
    const url = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${convertedPath}?alt=media`; // TODO: this conversion should be done upon receiving data from the server - it should not be the component's responsibility, then we can just use the path as is and don't need to depend on sveltefirets and don't need to lazy-load this component
    const audio = new Audio(url);
    audio.play();
    playing = true;
    audio.addEventListener('ended', () => {
      playing = false;
    });
    // TODO: unsubscribe listener
  }

  // This should be done upon getting page data, in a load function, not in this component
  // async function getSpeakerName(sf) {
  //   console.log(sf);
  //   const speakerSnap = await Firestore doc >> (`speakers/${sf.sp}`);
  //   const speaker = { id: speakerSnap.id, ...speakerSnap.data() };

  //   console.log(speaker);
  //   return speaker;
  // }
</script>

<ShowHide let:show let:toggle>
  {#if entry.sf}
    <!-- preventDefault -->
    <!-- https://svelte.dev/tutorial/adding-parameters-to-actions -->
    <div
      class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
    justify-center cursor-pointer p-1 select-none"
      use:longpress={800}
      on:click={() => {
        if (canEdit) {
          toggle();
        } else {
          initAudio(entry.sf);
        }
      }}
      on:longpress={() => initAudio(entry.sf)}>
      <span class:text-blue-700={playing} class="i-material-symbols-hearing text-2xl mt-1" />
      <div class="text-gray-600 text-sm mt-1">
        {$t('audio.listen', { default: 'Listen' })}
        {#if !minimal && canEdit}
          +
          {$t('audio.edit_audio', { default: 'Edit Audio' })}
        {/if}
        <!-- {#if !minimal && entry.sf.speakerName}
        to
        <b>{entry.sf.speakerName}</b>
      {/if} -->
        <!-- {#if entry.sf.sp}
        {#await getSpeakerName(entry.sf.sp) then speaker}
            Speaker: {speaker && speaker.displayName}
        {/await}
      {/if} -->
      </div>
    </div>
  {:else if canEdit}
    <div
      class="{$$props.class} hover:bg-gray-300 flex flex-col items-center
    justify-center cursor-pointer p-2 text-lg"
      on:click={toggle}>
      <span class="i-fa6-solid-microphone my-1 mx-2 text-blue-800" />
      {#if !minimal}
        <div class="text-blue-800 text-xs">
          {$t('audio.add_audio', { default: 'Add Audio' })}
        </div>
      {/if}
    </div>
  {/if}

  {#if show}
    {#await import('$lib/components/audio/EditAudio.svelte') then { default: EditAudio }}
      <EditAudio {entry} sound_file={entry.sound_files?.[0]} on:close={toggle} />
    {/await}
  {/if}
</ShowHide>

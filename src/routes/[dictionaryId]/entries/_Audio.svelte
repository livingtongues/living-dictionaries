<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry } from '$lib/interfaces';
  export let entry: IEntry,
    minimal = false;
  import { canEdit } from '$lib/stores';
  import { longpress } from '$svelteui/actions/longpress';
  import { firebaseConfig } from '$sveltefire/config';

  let playing = false;

  function initAudio(sf) {
    const convertedPath = sf.path.replace(/\//g, '%2F');
    const url = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${convertedPath}?alt=media`;
    const audio = new Audio(url);
    audio.play();
    playing = true;
    audio.addEventListener('ended', () => {
      playing = false;
    });
    // TODO: unsubscribe listener
  }

  // async function getSpeakerName(sf) {
  //   console.log(sf);
  //   const speakerSnap = await Firestore doc >> (`speakers/${sf.sp}`);
  //   const speaker = { id: speakerSnap.id, ...speakerSnap.data() };

  //   console.log(speaker);
  //   return speaker;
  // }

  let openAudioModal = false;
</script>

{#if entry.sf}
  <!-- preventDefault -->
  <!-- https://svelte.dev/tutorial/adding-parameters-to-actions -->
  <div
    class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
    justify-center cursor-pointer p-1 select-none"
    use:longpress={800}
    on:click={() => {
      if ($canEdit) {
        openAudioModal = true;
      } else {
        initAudio(entry.sf);
      }
    }}
    on:longpress={() => initAudio(entry.sf)}
  >
    {#if playing}
      <i class="fas fa-ear fa-lg mt-1" />
    {:else}<i class="far fa-ear fa-lg mt-1" />{/if}
    <div class="text-gray-600 text-sm mt-1">
      {$_('audio.listen', { default: 'Listen' })}
      {#if !minimal && $canEdit}
        +
        {$_('audio.edit_audio', { default: 'Edit Audio' })}
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
{:else if $canEdit}
  <div
    class="{$$props.class} hover:bg-gray-300 flex flex-col items-center
    justify-center cursor-pointer p-2 text-lg"
    on:click={() => (openAudioModal = true)}
  >
    <i class="far fa-microphone my-1 mx-2 text-blue-800" />
    {#if !minimal}
      <div class="text-blue-800 text-xs">
        {$_('audio.add_audio', { default: 'Add Audio' })}
      </div>
    {/if}
  </div>
{/if}

{#if openAudioModal}
  {#await import('$lib/components/audio/EditAudio.svelte') then EditAudio}
    <EditAudio.default
      {entry}
      on:close={() => {
        openAudioModal = null;
      }}
    />
  {/await}
{/if}

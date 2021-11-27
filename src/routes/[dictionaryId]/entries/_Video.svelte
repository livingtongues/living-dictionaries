<script lang="ts">
  import { canEdit } from '$lib/stores';
  import { longpress } from '$svelteui/actions/longpress';
  import type { IEntry } from '$lib/interfaces';
  export let entry: IEntry,
    minimal = false;

  let playing = false;
  /* function initVideo(sf) {
    const convertedPath = sf.path.replace(/\//g, '%2F');
    const url = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${convertedPath}?alt=media`;
    const audio = new Audio(url);
    audio.play();
    playing = true;
    audio.addEventListener('ended', () => {
      playing = false;
    });
    // TODO: unsubscribe listener
  } */

  let openVideoModal = false;
</script>

<div
  class="{$$props.class} hover:bg-gray-200 flex flex-col items-center
    justify-center cursor-pointer p-1 select-none"
  use:longpress={800}
  on:click={() => {
    if ($canEdit) {
      openVideoModal = true;
    } else {
      //initVideo(entry.sf);
    }
  }}
  on:longpress={() => console.log('init Video')}>
  {#if playing}
    <i class="fas fa-video fa-lg mt-1" />
  {:else}<i class="far fa-video fa-lg mt-1" />{/if}
  <div class="text-gray-600 text-sm mt-1">
    Watch
    {#if !minimal && $canEdit}
      + Edit video
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

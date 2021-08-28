<script lang="ts">
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import { firebaseConfig } from '$sveltefire/config';
  import { longpress } from '$svelteui/actions/longpress';
  import type { IEntry } from '$lib/interfaces';
  export let entry: IEntry,
    canEdit = false;

  let playing;
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
</script>

<ShowHide let:toggle let:show>
  {#if entry.sf}
    <div
      class="hover:bg-gray-200 flex flex-col items-center justify-center
  cursor-pointer h-full select-none text-sm"
      use:longpress
      on:shortpress={() => {
        if (canEdit) {
          toggle();
        } else {
          initAudio(entry.sf);
        }
      }}
      on:longpress={() => initAudio(entry.sf)}>
      <i class="{playing ? 'fas' : 'far'} fa-ear" />
    </div>
  {:else if canEdit}
    <div
      class="hover:bg-gray-200 flex flex-col items-center justify-center
  cursor-pointer h-full select-none text-sm"
      on:click={toggle}>
      <i class="far fa-microphone text-blue-800" />
    </div>
  {/if}
  {#if show}
    {#await import('$lib/components/audio/EditAudio.svelte') then { default: EditAudio }}
      <EditAudio {entry} on:close={toggle} />
    {/await}
  {/if}
</ShowHide>

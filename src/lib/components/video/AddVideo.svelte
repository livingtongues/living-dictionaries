<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$svelteui/ui/Button.svelte';
  import RecordVideo from '$lib/components/video/RecordVideo.svelte';
  import SelectVideo from './SelectVideo.svelte';
  import PasteVideoLink from './PasteVideoLink.svelte';
  import VideoIFrame from './VideoIFrame.svelte';
  import { deleteVideo } from '$lib/helpers/delete';
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte';
  import { firebaseConfig } from '$sveltefirets';
  import { dictionary, admin } from '$lib/stores';
  import type { IEntry, IVideo } from '$lib/interfaces';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import { addVideo } from '$lib/helpers/media/update';

  export let entry: IEntry;
  let video: IVideo;
</script>

<Modal on:close>
  <span slot="heading"> <i class="far fa-film-alt text-sm" /> {entry.lx} </span>

  <div class="mb-3">
    <SelectSpeaker
      dictionaryId={$dictionary.id}
      let:speakerId
      on:update={async ({ detail }) => {
        if (video && detail.speakerId != video.sp) {
          alert(
            'You can only change the speaker of a video that is not yet uploaded for the moment. This function is still to come.'
          );
          // video.sp = detail.speakerId;
          // TODO: update video
        }
      }}>
      {#if video}
        {#if !video.youtubeId && !video.vimeoId}
          <video
            controls
            autoplay
            playsinline
            src={`https://firebasestorage.googleapis.com/v0/b/${
              firebaseConfig.storageBucket
            }/o/${video.path.replace(/\//g, '%2F')}?alt=media`}>
            <track kind="captions" />
          </video>
        {:else}
          <VideoIFrame {video} />
        {/if}
      {:else if speakerId}
        <ShowHide let:show let:toggle>
          {#if !show}
            <PasteVideoLink
              on:update={async ({ detail }) => {
                if (detail.type === 'youtube') {
                  video = { sp: speakerId, youtubeId: detail.videoId };
                  await addVideo(entry, video);
                } else if (detail.type === 'vimeo') {
                  video = { sp: speakerId, vimeoId: detail.videoId };
                  await addVideo(entry, video);
                }
              }} />

            <Button onclick={toggle} class="mb-4 w-full" form="primary" type="button">
              <i class="far fa-microphone-alt" />
              {$_('video.prepare_to_record_video', {
                default: 'Prepare to Record with Microphone & Camera',
              })}
            </Button>

            <SelectVideo let:file>
              {#await import('$lib/components/video/UploadVideo.svelte') then { default: UploadVideo }}
                <UploadVideo {file} {entry} {speakerId} />
              {/await}
            </SelectVideo>
          {:else}
            <RecordVideo let:videoBlob>
              {#await import('$lib/components/video/UploadVideo.svelte') then { default: UploadVideo }}
                <UploadVideo file={videoBlob} {entry} {speakerId} />
              {/await}
            </RecordVideo>
          {/if}
        </ShowHide>
      {/if}
    </SelectSpeaker>
  </div>

  <div class="modal-footer">
    {#if $admin > 1}
      {#await import('$svelteui/data/JSON.svelte') then { default: JSON }}
        <JSON obj={entry} />
        <div class="w-1" />
      {/await}
    {/if}
    {#if video}
      {#if !video.youtubeId && !video.vimeoId}
        <Button
          href={`https://firebasestorage.googleapis.com/v0/b/${
            firebaseConfig.storageBucket
          }/o/${video.path.replace(/\//g, '%2F')}?alt=media`}
          target="_blank">
          <i class="fas fa-download" />
          <span class="hidden sm:inline"
            >{$_('misc.download', {
              default: 'Download',
            })}</span>
        </Button>
        <div class="w-1" />
      {/if}
      <Button onclick={() => deleteVideo(entry, video)} color="red">
        <i class="far fa-trash-alt" />&nbsp;
        <span class="hidden sm:inline"
          >{$_('misc.delete', {
            default: 'Delete',
          })}</span>
      </Button>
      <div class="w-1" />
    {/if}

    <Button onclick={close} color="black">
      {$_('misc.close', { default: 'Close' })}
    </Button>
  </div>
</Modal>

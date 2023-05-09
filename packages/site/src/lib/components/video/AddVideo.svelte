<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Button, Modal, ShowHide } from 'svelte-pieces';
  import RecordVideo from '$lib/components/video/RecordVideo.svelte';
  import SelectVideo from './SelectVideo.svelte';
  import PasteVideoLink from './PasteVideoLink.svelte';
  import VideoIFrame from '$lib/components/video/VideoIFrame.svelte';
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte';
  import { dictionary } from '$lib/stores';
  import type { GoalDatabaseVideo, IEntry } from '@living-dictionaries/types';
  import { addVideo } from '$lib/helpers/media/update';
  import { createEventDispatcher } from 'svelte';
  import { expand_video } from '$lib/transformers/expand_entry';

  const dispatch = createEventDispatcher();
  const close = () => dispatch('close');

  export let entry: IEntry;
  let database_video: GoalDatabaseVideo;
</script>

<Modal on:close>
  <span slot="heading"> <i class="far fa-film-alt text-sm" /> {entry.lexeme} </span>

  <SelectSpeaker dictionaryId={$dictionary.id} let:speakerId>
    {#if database_video?.youtubeId || database_video?.vimeoId}
      <VideoIFrame video={expand_video(database_video)} />
      <div class="modal-footer">
        <Button onclick={close} color="black">
          {$t('misc.cancel', { default: 'Cancel' })}
        </Button>
        <div class="w-1" />
        <Button onclick={async () => await addVideo(entry.id, database_video)} form="filled">
          {$t('misc.save', { default: 'Save' })}
        </Button>
      </div>
    {:else if speakerId}
      <ShowHide let:show={record} let:toggle>
        {#if !record}
          <PasteVideoLink
            on:update={({ detail }) => {
              database_video = { ...detail, sp: [speakerId] };
            }} />

          <SelectVideo let:file>
            {#await import('$lib/components/video/UploadVideo.svelte') then { default: UploadVideo }}
              <UploadVideo {file} {entry} {speakerId} />
            {/await}
          </SelectVideo>

          <Button onclick={toggle} class="mt-4 !py-4 w-full" color="red" type="button">
            <span class="i-uil-microphone" />
            {$t('video.prepare_to_record_video', {
              default: 'Prepare to Record with Microphone & Camera',
            })}
          </Button>
        {:else}
          <RecordVideo let:videoBlob let:reset>
            <!-- svelte-ignore a11y-media-has-caption -->
            <video controls autoplay playsinline src={URL.createObjectURL(videoBlob)} />

            <ShowHide let:show let:toggle>
              {#if !show}
                <div class="modal-footer">
                  <Button onclick={reset} color="red"
                    ><i class="far fa-trash-alt" />
                    {$t('misc.delete', {
                      default: 'Delete',
                    })}</Button>
                  <div class="w-1" />
                  <Button onclick={toggle} color="green" form="filled"
                    ><i class="fas fa-upload" /> {$t('misc.upload', { default: 'Upload' })}</Button>
                </div>
              {:else}
                {#await import('$lib/components/video/UploadVideo.svelte') then { default: UploadVideo }}
                  <UploadVideo file={videoBlob} {entry} {speakerId} />
                {/await}
              {/if}
            </ShowHide>
          </RecordVideo>
        {/if}
      </ShowHide>
    {:else}
      <div class="modal-footer">
        <Button onclick={close} color="black">
          {$t('misc.cancel', { default: 'Cancel' })}
        </Button>
      </div>
    {/if}
  </SelectSpeaker>
</Modal>

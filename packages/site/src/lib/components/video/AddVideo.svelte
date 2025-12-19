<script lang="ts">
  import { Button, Modal, ShowHide } from '$lib/svelte-pieces'
  import type { EntryData, HostedVideo } from '@living-dictionaries/types'
  import type { Readable } from 'svelte/store'
  import SelectVideo from './SelectVideo.svelte'
  import PasteVideoLink from './PasteVideoLink.svelte'
  import type { VideoUploadStatus } from './upload-video'
  import { page } from '$app/state'
  import RecordVideo from '$lib/components/video/RecordVideo.svelte'
  import VideoThirdParty from '$lib/components/video/VideoThirdParty.svelte'
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte'

  let { dbOperations } = $derived(page.data)

  interface Props {
    on_close: () => void;
    entry: EntryData;
  }

  let { on_close, entry }: Props = $props();

  let hosted_video: HostedVideo = $state()
  let upload_triggered = $state(false)

  function startUpload(file: File | Blob, speaker_id: string): Readable<VideoUploadStatus> {
    const uploadStore = dbOperations.uploadVideo({ file, sense_id: entry.senses[0].id, speaker_id })
    const unsubscribe = uploadStore.subscribe((status) => {
      if (status?.progress === 100) {
        upload_triggered = true
        unsubscribe()
      }
    })
    return uploadStore
  }
</script>

<Modal {on_close}>
  {#snippet heading()}
    <span > <i class="far fa-film-alt text-sm"></i> {entry.main.lexeme.default} </span>
  {/snippet}

  <SelectSpeaker >
    {#snippet children({ speaker_id })}
        {#if hosted_video}
        <VideoThirdParty {hosted_video} />
        <div class="modal-footer">
          <Button onclick={() => hosted_video = null} color="black">
            {page.data.t('misc.cancel')}
          </Button>
          <div class="w-1"></div>
          <Button
            onclick={async () => {
              const data = await dbOperations.insert_video({ sense_id: entry.senses[0].id, video: { hosted_elsewhere: hosted_video } })
              await dbOperations.assign_speaker({ speaker_id, media: 'video', media_id: data.id })
              on_close()
            }}
            form="filled">
            {page.data.t('misc.save')}
          </Button>
        </div>
      {:else if speaker_id}
        <ShowHide  >
          {#snippet children({ show: record, toggle })}
                    {#if !record && !upload_triggered}
              <PasteVideoLink on_pasted_valid_url={video_info => hosted_video = video_info} />
              <SelectVideo >
                {#snippet children({ file })}
                            {@const upload_status = startUpload(file, speaker_id)}
                  {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
                    <UploadProgressBarStatus {upload_status} />
                  {/await}
                                          {/snippet}
                        </SelectVideo>

              <Button onclick={toggle} class="mt-4 !py-4 w-full" color="red" type="button">
                <span class="i-uil-microphone"></span>
                {page.data.t('video.prepare_to_record_video')}
              </Button>
            {:else}
              <RecordVideo  >
                {#snippet children({ videoBlob, reset })}
                            <video controls autoplay playsinline src={URL.createObjectURL(videoBlob)}></video>

                  <ShowHide  >
                    {#snippet children({ show, toggle })}
                                {#if !show}
                        <div class="modal-footer">
                          <Button onclick={reset} color="red"><i class="far fa-trash-alt"></i>
                            {page.data.t('misc.delete')}</Button>
                          <div class="w-1"></div>
                          <Button onclick={toggle} color="green" form="filled"><i class="fas fa-upload"></i> {page.data.t('misc.upload')}</Button>
                        </div>
                      {:else if !upload_triggered}
                        {@const upload_status = startUpload(videoBlob, speaker_id)}
                        {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
                          <UploadProgressBarStatus {upload_status} />
                        {/await}
                      {/if}
                                                  {/snippet}
                            </ShowHide>
                                          {/snippet}
                        </RecordVideo>
            {/if}
                            {/snippet}
                </ShowHide>
      {:else}
        <div class="modal-footer">
          <Button onclick={close} color="black">
            {page.data.t('misc.cancel')}
          </Button>
        </div>
      {/if}
          {/snippet}
    </SelectSpeaker>
</Modal>

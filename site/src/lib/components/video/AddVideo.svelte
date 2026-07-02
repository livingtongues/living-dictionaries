<script lang="ts">
  import type { EntryData, HostedVideo } from '$lib/types'
  import type { Readable } from 'svelte/store'
  import SelectVideo from './SelectVideo.svelte'
  import PasteVideoLink from './PasteVideoLink.svelte'
  import type { VideoUploadStatus } from './upload-video'
  import { Button, Modal, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import RecordVideo from '$lib/components/video/RecordVideo.svelte'
  import VideoThirdParty from '$lib/components/video/VideoThirdParty.svelte'
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte'
  import { get_headword } from '$lib/helpers/orthographies'
  import IconUilMicrophone from '~icons/uil/microphone'

  const { dbOperations } = $derived(page.data)

  interface Props {
    on_close: () => void
    entry: EntryData
  }

  const { on_close, entry }: Props = $props()

  let hosted_video: HostedVideo = $state()
  let upload_triggered = $state(false)
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: page.data.dictionary?.orthographies }))

  function startUpload({ file, speaker_id, source_slug }: { file: File | Blob, speaker_id?: string, source_slug?: string }): Readable<VideoUploadStatus> {
    const uploadStore = dbOperations.uploadVideo({ file, sense_id: entry.senses[0].id, speaker_id, source: source_slug })
    const unsubscribe = uploadStore.subscribe((status) => {
      if (status?.progress === 100) {
        upload_triggered = true
        unsubscribe()
      }
    })
    return uploadStore
  }

  async function save_hosted({ speaker_id, source_slug }: { speaker_id?: string, source_slug?: string }) {
    const data = await dbOperations.insert_video({ sense_id: entry.senses[0].id, video: { hosted_elsewhere: hosted_video, ...(source_slug ? { source: source_slug } : {}) } })
    if (speaker_id)
      await dbOperations.assign_speaker({ speaker_id, media: 'video', media_id: data.id })
    on_close()
  }
</script>

<Modal on:close={on_close}>
  {#snippet heading()}
    <span> <i class="far fa-film-alt heading-icon"></i> {headword.value} </span>
  {/snippet}

  <SelectSpeaker>
    {#snippet children({ speaker_id, source_slug })}
      {#if hosted_video}
        <VideoThirdParty {hosted_video} />
        <div class="modal-footer">
          <Button onclick={() => hosted_video = null} color="black">
            {page.data.t('misc.cancel')}
          </Button>
          <div style="width: 0.25rem"></div>
          <Button
            onclick={() => save_hosted({ speaker_id, source_slug })}
            form="filled">
            {page.data.t('misc.save')}
          </Button>
        </div>
      {:else if speaker_id || source_slug}
        <ShowHide>
          {#snippet children({ show: record, toggle })}
            {#if !record && !upload_triggered}
              <PasteVideoLink on_pasted_valid_url={video_info => hosted_video = video_info} />
              <SelectVideo>
                {#snippet children({ file })}
                  {@const upload_status = startUpload({ file, speaker_id, source_slug })}
                  {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
                    <UploadProgressBarStatus {upload_status} />
                  {/await}
                {/snippet}
              </SelectVideo>

              <Button onclick={toggle} class="record-video-button" color="red" type="button">
                <IconUilMicrophone class="icon-inline" />
                {page.data.t('video.prepare_to_record_video')}
              </Button>
            {:else}
              <RecordVideo>
                {#snippet children({ videoBlob, reset })}
                  <video controls autoplay playsinline src={URL.createObjectURL(videoBlob)}></video>

                  <ShowHide>
                    {#snippet children({ show, toggle })}
                      {#if !show}
                        <div class="modal-footer">
                          <Button onclick={reset} color="red"><i class="far fa-trash-alt"></i>
                            {page.data.t('misc.delete')}</Button>
                          <div style="width: 0.25rem"></div>
                          <Button onclick={toggle} color="green" form="filled"><i class="fas fa-upload"></i> {page.data.t('misc.upload')}</Button>
                        </div>
                      {:else if !upload_triggered}
                        {@const upload_status = startUpload({ file: videoBlob, speaker_id, source_slug })}
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

<style>
  .heading-icon {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  :global(.record-video-button) {
    margin-top: 1rem;
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
    width: 100%;
  }
</style>

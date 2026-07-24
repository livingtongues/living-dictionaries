<script lang="ts">
  import IconFilm from '~icons/fa-solid/film'
  import IconTrashAlt from '~icons/fa-regular/trash-alt'
  import IconUpload from '~icons/fa-solid/upload'
  import type { EntryData, HostedMetadata, HostedVideo } from '$lib/types'
  import SelectVideo from './SelectVideo.svelte'
  import PasteVideoLink from './PasteVideoLink.svelte'
  import type { MediaUploadHandle } from '$lib/media/upload-media'
  import type { MediaUploadContext } from '$lib/media/add-media'
  import { add_video, track_media_uploaded } from '$lib/media/add-media'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import RecordVideo from '$lib/components/video/RecordVideo.svelte'
  import VideoThirdParty from '$lib/components/video/VideoThirdParty.svelte'
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte'
  import { get_headword } from '$lib/orthography/orthographies'
  import IconUilMicrophone from '~icons/uil/microphone'

  const { writes } = $derived(page.data)

  interface Props {
    on_close: () => void
    entry: EntryData
    /** A file dropped onto a row before the modal opened — staged for upload once attribution is chosen. */
    initial_file?: File
    context?: MediaUploadContext
  }

  const { on_close, entry, initial_file = undefined, context = 'entry' }: Props = $props()
  const staged_file: File | undefined = initial_file

  let hosted_video: HostedVideo = $state()
  let hosted_metadata: HostedMetadata = $state()
  let upload_triggered = $state(false)
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: page.data.dictionary?.orthographies }))

  function start_upload({ file, speaker_id, source_slug }: { file: File | Blob, speaker_id?: string, source_slug?: string }): MediaUploadHandle {
    const handle = add_video({ writes, dictionary_id: page.data.dictionary.id, file, sense_id: entry.senses[0].id, speaker_id, source: source_slug, context })
    handle.done.then(() => upload_triggered = true).catch(() => undefined) // error renders in the progress pill
    return handle
  }

  async function save_hosted({ speaker_id, source_slug }: { speaker_id?: string, source_slug?: string }) {
    const data = await writes.insert_video({ sense_id: entry.senses[0].id, video: { hosted_elsewhere: hosted_video, ...(hosted_metadata ? { hosted_metadata } : {}), ...(source_slug ? { source: source_slug } : {}) } })
    if (speaker_id)
      await writes.assign_speaker({ speaker_id, media: 'video', media_id: data.id })
    track_media_uploaded({ dictionary_id: page.data.dictionary.id, media: 'video', context })
    on_close()
  }
</script>

<Modal on_close={on_close}>
  {#snippet heading()}
    <span> <IconFilm class="heading-icon" /> {headword.value} </span>
  {/snippet}

  <SelectSpeaker>
    {#snippet children({ speaker_id, source_slug })}
      {#if hosted_video}
        <VideoThirdParty {hosted_video} {hosted_metadata} />
        <div class="modal-footer">
          <HeadlessButton class="btn btn-default" onclick={() => { hosted_video = null; hosted_metadata = null }}>
            {page.data.t('misc.cancel')}
          </HeadlessButton>
          <div style="width: 0.25rem"></div>
          <HeadlessButton class="btn-primary btn-default" onclick={() => save_hosted({ speaker_id, source_slug })}>
            {page.data.t('misc.save')}
          </HeadlessButton>
        </div>
      {:else if speaker_id || source_slug}
        <ShowHide>
          {#snippet children({ show: record, toggle })}
            {#if staged_file && !upload_triggered}
              {@const handle = start_upload({ file: staged_file, speaker_id, source_slug })}
              {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
                <UploadProgressBarStatus {handle} />
              {/await}
            {:else if !record && !upload_triggered}
              <PasteVideoLink on_pasted_valid_url={({ hosted_video: pasted_video, hosted_metadata: pasted_metadata }) => { hosted_video = pasted_video; hosted_metadata = pasted_metadata }} />
              <SelectVideo>
                {#snippet children({ file })}
                  {@const handle = start_upload({ file, speaker_id, source_slug })}
                  {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
                    <UploadProgressBarStatus {handle} />
                  {/await}
                {/snippet}
              </SelectVideo>

              <HeadlessButton onclick={toggle} class="btn btn-default record-video-button" type="button">
                <IconUilMicrophone />
                {page.data.t('video.prepare_to_record_video')}
              </HeadlessButton>
            {:else}
              <RecordVideo>
                {#snippet children({ videoBlob, reset })}
                  <video controls autoplay playsinline src={URL.createObjectURL(videoBlob)}></video>

                  <ShowHide>
                    {#snippet children({ show, toggle })}
                      {#if !show}
                        <div class="modal-footer">
                          <HeadlessButton style="color: var(--danger)" class="btn btn-default" onclick={reset}><IconTrashAlt />
                            {page.data.t('misc.delete')}</HeadlessButton>
                          <div style="width: 0.25rem"></div>
                          <HeadlessButton class="btn-primary btn-default" onclick={toggle}><IconUpload /> {page.data.t('misc.upload')}</HeadlessButton>
                        </div>
                      {:else if !upload_triggered}
                        {@const handle = start_upload({ file: videoBlob, speaker_id, source_slug })}
                        {#await import('$lib/components/audio/UploadProgressBarStatus.svelte') then { default: UploadProgressBarStatus }}
                          <UploadProgressBarStatus {handle} />
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
          <HeadlessButton class="btn btn-default" onclick={close}>
            {page.data.t('misc.cancel')}
          </HeadlessButton>
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

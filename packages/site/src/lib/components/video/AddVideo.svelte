<script lang="ts">
  import { Button, Modal, ShowHide } from 'svelte-pieces'
  import type { ExpandedEntry, GoalDatabaseVideo } from '@living-dictionaries/types'
  import SelectVideo from './SelectVideo.svelte'
  import PasteVideoLink from './PasteVideoLink.svelte'
  import { page } from '$app/stores'
  import RecordVideo from '$lib/components/video/RecordVideo.svelte'
  import VideoThirdParty from '$lib/components/video/VideoThirdParty.svelte'
  import SelectSpeaker from '$lib/components/media/SelectSpeaker.svelte'
  import { expand_video } from '$lib/transformers/expand_entry'

  $: ({ dictionary, speakers, user, dbOperations } = $page.data)

  export let on_close: () => void
  export let entry: ExpandedEntry

  let database_video: GoalDatabaseVideo
</script>

<Modal on:close={on_close}>
  <span slot="heading"> <i class="far fa-film-alt text-sm" /> {entry.lexeme} </span>

  <SelectSpeaker speakers={$speakers} add_speaker={dbOperations.add_speaker} let:speakerId>
    {#if database_video?.youtubeId || database_video?.vimeoId}
      <VideoThirdParty video={expand_video(database_video, 'storage-bucket-irrelevant')} />
      <div class="modal-footer">
        <Button onclick={close} color="black">
          {$page.data.t('misc.cancel')}
        </Button>
        <div class="w-1" />
        <Button onclick={async () => await dbOperations.addVideo(entry.id, database_video)} form="filled">
          {$page.data.t('misc.save')}
        </Button>
      </div>
    {:else if speakerId}
      <ShowHide let:show={record} let:toggle>
        {#if !record}
          <PasteVideoLink
            on:update={({ detail }) => {
              database_video = { ...detail, sp: [speakerId] }
            }} />

          <SelectVideo let:file>
            {#await import('$lib/components/video/UploadVideo.svelte') then { default: UploadVideo }}
              <UploadVideo dictionary_id={$dictionary.id} {dbOperations} user={$user} {file} entryId={entry.id} {speakerId} />
            {/await}
          </SelectVideo>

          <Button onclick={toggle} class="mt-4 !py-4 w-full" color="red" type="button">
            <span class="i-uil-microphone" />
            {$page.data.t('video.prepare_to_record_video')}
          </Button>
        {:else}
          <RecordVideo let:videoBlob let:reset>
            <video controls autoplay playsinline src={URL.createObjectURL(videoBlob)} />

            <ShowHide let:show let:toggle>
              {#if !show}
                <div class="modal-footer">
                  <Button onclick={reset} color="red"><i class="far fa-trash-alt" />
                    {$page.data.t('misc.delete')}</Button>
                  <div class="w-1" />
                  <Button onclick={toggle} color="green" form="filled"><i class="fas fa-upload" /> {$page.data.t('misc.upload')}</Button>
                </div>
              {:else}
                {#await import('$lib/components/video/UploadVideo.svelte') then { default: UploadVideo }}
                  <UploadVideo dictionary_id={$dictionary.id} {dbOperations} user={$user} file={videoBlob} entryId={entry.id} {speakerId} />
                {/await}
              {/if}
            </ShowHide>
          </RecordVideo>
        {/if}
      </ShowHide>
    {:else}
      <div class="modal-footer">
        <Button onclick={close} color="black">
          {$page.data.t('misc.cancel')}
        </Button>
      </div>
    {/if}
  </SelectSpeaker>
</Modal>

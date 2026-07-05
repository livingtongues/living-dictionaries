<script lang="ts">
  import MediaStream from '../record/MediaStream.svelte'
  import Recorder from '../record/Recorder.svelte'
  import { srcObject } from './src-object'
  import Button from '$lib/components/ui/Button.svelte'
  import { page } from '$app/state'

  interface Props {
    children?: import('svelte').Snippet<[any]>
  }

  const { children }: Props = $props()

  let videoBlob: Blob = $state()
</script>

{#if !videoBlob}
  <MediaStream>
    {#snippet children({ stream, microphones, cameras, chooseMicrophone, chooseCamera, selectedMicrophone, selectedCamera })}
      <video muted volume={0} use:srcObject={stream} autoplay playsinline></video>

      <Recorder
        {stream}
        options={{
          type: 'video',
          mimeType: 'video/webm;codecs=vp8',
          bitsPerSecond: 256 * 8 * 1024,
          checkForInactiveTracks: true,
          timeSlice: 1000,
        }}>
        {#snippet children({ start, pause, stop, recordingTime, state })}
          {#if state === 'inactive'}
            <Button onclick={start} color="red" class="record-full record-tall record-spaced">
              {page.data.t('audio.tap_to_record')}
            </Button>

            {#if microphones.length > 1 && selectedMicrophone}
              <select
                class="device-select"
                value={selectedMicrophone.deviceId}
                onchange={e =>
                  // @ts-ignore
                  chooseMicrophone(e.target.value)}>
                {#each microphones as microphone (microphone.deviceId)}
                  <option value={microphone.deviceId}>
                    {microphone.label}
                  </option>
                {/each}
              </select>
            {/if}
            {#if cameras.length > 1 && selectedCamera}
              <select
                class="device-select"
                value={selectedCamera.deviceId}
                onchange={e =>
                  // @ts-ignore
                  chooseCamera(e.target.value)}>
                {#each cameras as camera (camera.deviceId)}
                  <option value={camera.deviceId}>
                    {camera.label}
                  </option>
                {/each}
              </select>
            {/if}
          {/if}

          {#if state === 'recording' || state === 'paused'}
            <Button
              onclick={async () => {
                videoBlob = await stop()
              }}
              color="red"
              class="record-full record-tall record-spaced">
              <div class="recording-time">{recordingTime}s</div>
              {page.data.t('audio.stop_recording')}
            </Button>
            <Button class="record-full record-spaced" color="black" onclick={pause}>{state === 'recording' ? 'Pause' : 'Unpause'}</Button>
          {/if}
        {/snippet}
      </Recorder>

    {/snippet}
    {#snippet denied()}
      <div>
        <div class="denied-note">
          <!-- audio.undo_permission_denied_explanation needs split -->
          Permission to access media was denied.
        </div>
        <Button
          class="record-spaced-2"
          form="filled"
          href="https://www.google.com/search?q=How+do+I+enable+microphone+access"
          target="_blank"
          rel="noopener">{page.data.t('audio.learn_more')}</Button>
      </div>
    {/snippet}

    {#snippet dismissed()}
      <div>
        <div class="denied-note">
          If you previously dismissed the browser's request, please reload and click 'Yes' when your
          browser asks for permission.
        </div>
        <div>
          <Button form="filled" class="record-spaced-2" onclick={() => location.reload()}>{page.data.t('audio.reload')}</Button>
        </div>
      </div>
    {/snippet}

    {#snippet loading()}
      <div>Accessing Microphone and Camera <i class="far fa-spinner fa-pulse"></i></div>
    {/snippet}
  </MediaStream>
{:else}
  {@render children?.({ videoBlob, reset: () => {
    videoBlob = undefined
  } })}
{/if}

<style>
  :global(.record-full) {
    width: 100%;
  }

  :global(.record-tall) {
    height: 6rem;
  }

  :global(.record-spaced) {
    margin-top: 0.25rem;
  }

  :global(.record-spaced-2) {
    margin-top: 0.5rem;
  }

  .device-select {
    padding: 0.25rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    max-width: 100%;
    margin-top: 0.25rem;
  }

  .recording-time {
    font-weight: 600;
    font-family: var(--font-mono);
    font-size: 1.5rem;
    line-height: 2rem;
  }

  .denied-note {
    color: rgb(239 68 68); /* red-500 */
  }
</style>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { Button } from 'svelte-pieces';
  import MediaStream from '../record/MediaStream.svelte';
  import Recorder from '../record/Recorder.svelte';
  import { srcObject } from './srcObject';
  let videoBlob: Blob;
</script>

{#if !videoBlob}
  <MediaStream
    let:stream
    let:microphones
    let:cameras
    let:chooseMicrophone
    let:chooseCamera
    let:selectedMicrophone
    let:selectedCamera>
    <video muted volume={0} use:srcObject={stream} autoplay playsinline />

    <Recorder
      {stream}
      options={{
        type: 'video',
        mimeType: 'video/webm;codecs=vp8',
        bitsPerSecond: 256 * 8 * 1024,
        checkForInactiveTracks: true,
        timeSlice: 1000,
      }}
      let:start
      let:pause
      let:stop
      let:recordingTime
      let:state>
      {#if state === 'inactive'}
        <Button onclick={start} color="red" class="w-full h-24 mt-1">
          {$_('audio.tap_to_record', { default: 'Tap to Record' })}
        </Button>

        {#if microphones.length > 1 && selectedMicrophone}
          <select
            class="p-1 text-sm max-w-full mt-1"
            value={selectedMicrophone.deviceId}
            on:change={(e) =>
              //@ts-ignore
              chooseMicrophone(e.target.value)}>
            {#each microphones as microphone}
              <option value={microphone.deviceId}>
                {microphone.label}
              </option>
            {/each}
          </select>
        {/if}
        {#if cameras.length > 1 && selectedCamera}
          <select
            class="p-1 text-sm max-w-full mt-1"
            value={selectedCamera.deviceId}
            on:change={(e) =>
              //@ts-ignore
              chooseCamera(e.target.value)}>
            {#each cameras as camera}
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
            videoBlob = await stop();
          }}
          color="red"
          class="w-full h-24 mt-1">
          <div class="font-semibold font-mono text-2xl">{recordingTime}s</div>
          {$_('audio.stop_recording', { default: 'Stop Recording' })}
        </Button>
        <Button class="w-full mt-1" color="black" onclick={pause}
        >{state === 'recording' ? 'Pause' : 'Unpause'}</Button>
      {/if}
    </Recorder>

    <div slot="denied">
      <div class="text-red-500">
        <!-- audio.undo_permission_denied_explanation needs split -->
        Permission to access media was denied.
      </div>
      <Button
        class="mt-2"
        form="filled"
        href="https://www.google.com/search?q=How+do+I+enable+microphone+access"
        target="_blank"
        rel="noopener">{$_('audio.learn_more', { default: 'Learn More' })}</Button>
    </div>

    <div slot="dismissed">
      <div class="text-red-500">
        If you previously dismissed the browser's request, please reload and click 'Yes' when your
        browser asks for permission.
      </div>
      <div>
        <Button form="filled" class="mt-2" onclick={() => location.reload()}
        >{$_('audio.reload', { default: 'Reload' })}</Button>
      </div>
    </div>

    <div slot="loading">Accessing Microphone and Camera <i class="far fa-spinner fa-pulse" /></div>
  </MediaStream>
{:else}
  <slot
    {videoBlob}
    reset={() => {
      videoBlob = undefined;
    }} />
{/if}

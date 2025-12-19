<script lang="ts">
  import { page } from '$app/state';
  import { Button } from 'svelte-pieces';
  import MediaStream from '../record/MediaStream.svelte';
  import Recorder from '../record/Recorder.svelte';
  import { srcObject } from './srcObject';
  interface Props {
    children?: import('svelte').Snippet<[any]>;
  }

  let { children }: Props = $props();

  let videoBlob: Blob = $state();
</script>

{#if !videoBlob}
  <MediaStream
    
    
    
    
    
    
    >
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
        }}
        
        
        
        
        >
        {#snippet children({ start, pause, stop, recordingTime, state })}
            {#if state === 'inactive'}
            <Button onclick={start} color="red" class="w-full h-24 mt-1">
              {page.data.t('audio.tap_to_record')}
            </Button>

            {#if microphones.length > 1 && selectedMicrophone}
              <select
                class="p-1 text-sm max-w-full mt-1"
                value={selectedMicrophone.deviceId}
                onchange={(e) =>
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
                onchange={(e) =>
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
              {page.data.t('audio.stop_recording')}
            </Button>
            <Button class="w-full mt-1" color="black" onclick={pause}>{state === 'recording' ? 'Pause' : 'Unpause'}</Button>
          {/if}
                  {/snippet}
        </Recorder>

      {/snippet}
      {#snippet denied()}
        <div >
        <div class="text-red-500">
          <!-- audio.undo_permission_denied_explanation needs split -->
          Permission to access media was denied.
        </div>
        <Button
          class="mt-2"
          form="filled"
          href="https://www.google.com/search?q=How+do+I+enable+microphone+access"
          target="_blank"
          rel="noopener">{page.data.t('audio.learn_more')}</Button>
      </div>
      {/snippet}

    {#snippet dismissed()}
        <div >
        <div class="text-red-500">
          If you previously dismissed the browser's request, please reload and click 'Yes' when your
          browser asks for permission.
        </div>
        <div>
          <Button form="filled" class="mt-2" onclick={() => location.reload()}>{page.data.t('audio.reload')}</Button>
        </div>
      </div>
      {/snippet}

    {#snippet loading()}
        <div >Accessing Microphone and Camera <i class="far fa-spinner fa-pulse"></i></div>
      {/snippet}
  </MediaStream>
{:else}
  {@render children?.({ videoBlob, reset: () => {
      videoBlob = undefined;
    }, })}
{/if}

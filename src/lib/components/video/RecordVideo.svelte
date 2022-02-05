<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Button from '$svelteui/ui/Button.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import MediaStream from '$svelteui/record/MediaStream.svelte';
  import Recorder from '$svelteui/record/Recorder.svelte';
  import { srcObject } from './srcObject';

  let videoBlob: Blob = null;
</script>

{#if !videoBlob}
  <MediaStream let:stream>
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
        <Button onclick={start} color="red" class="w-full h-24">
          {$_('audio.tap_to_record', { default: 'Tap to Record' })}
        </Button>
        <div class="text-gray-600 text-center text-xs mt-2">
          ({$_('audio.tapToStopRecording', { default: 'Then you will tap to stop recording' })})
        </div>
      {/if}

      {#if state === 'recording' || state === 'paused'}
        <Button onclick={pause}>{state === 'recording' ? 'Pause' : 'Unpause'}</Button>
        <Button
          onclick={async () => {
            videoBlob = await stop();
          }}
          color="red"
          class="w-full h-24">
          <div class="font-semibold font-mono text-2xl">{recordingTime}s</div>
          {$_('audio.stop_recording', { default: 'Stop Recording' })}
        </Button>
      {/if}

      <div>State: {state}</div>
      <div>Recording Time: {recordingTime}</div>
    </Recorder>

    <!-- svelte-ignore a11y-media-has-caption -->
    <video muted volume={0} use:srcObject={stream} autoplay playsinline />

    <div slot="denied">
      <div class="text-red-500">
        <!-- audio.undo_permission_denied_explanation needs split -->
        Permission to access media was denied.
      </div>
      <Button
        class="mt-2"
        form="primary"
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
        <Button form="primary" class="mt-2" onclick={() => location.reload()}
          >{$_('audio.reload', { default: 'Reload' })}</Button>
      </div>
    </div>

    <div slot="loading">Accessing Microphone and Camera <i class="far fa-spinner fa-pulse" /></div>
  </MediaStream>
{:else}
  <!-- svelte-ignore a11y-media-has-caption -->
  <video controls autoplay playsinline src={URL.createObjectURL(videoBlob)} />

  <ShowHide let:show let:toggle>
    {#if !show}
      <div class="flex justify-between pt-2">
        <Button onclick={() => (videoBlob = null)} color="red"
          >{$_('misc.delete', { default: 'Delete' })}</Button>
        <Button onclick={toggle} color="green">{$_('misc.upload', { default: 'Upload' })}</Button>
      </div>
    {:else}
      <slot {videoBlob} />
    {/if}
  </ShowHide>
{/if}

<!-- Deal with after initial admin testing: Only Firefox supports codecs=h264, other browsers support codecs=vp8. However I assigned h264 as the default because firefox crashes if is not established since the beginning.
if (navigator.userAgent.indexOf('Firefox') == -1) {
 options.mimeType = 'video/webm;codecs=vp8';
} -->

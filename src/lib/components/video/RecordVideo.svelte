<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Button from '$svelteui/ui/Button.svelte';

  export let videoBlob = null;
  export let permissionGranted = false;
  export let uploadVideo = () => {};
  let permissionDenied = false;

  let RecordRTC: typeof import('recordrtc');
  import { onMount } from 'svelte';
  onMount(async () => {
    RecordRTC = (await import('recordrtc')).default;
    // Could also use `await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/RecordRTC/5.5.6/RecordRTC.js');` in context module block
  });
  let recorder = null;
  let stream = null;
  let videoSource = null;
  let recording = false;
  let recordedVideo = false;
  $: videoBlob;

  async function checkAudioPermissions() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      if (videoSource) {
        videoSource.srcObject = stream;
      }
      permissionGranted = true;
      setTimeout(turnOffAllDevices, 60);
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  let recordingTime = 0;
  let interval;

  async function record() {
    try {
      recordedVideo = false;
      videoBlob = null;
      recording = true;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      videoSource.srcObject = stream;
      const options = {
        type: 'video',
        mimeType: 'video/mp4', // vp8, vp9, h264, mkv, opus/vorbis
        audioBitsPerSecond: 256 * 8 * 1024,
        videoBitsPerSecond: 256 * 8 * 1024,
        bitsPerSecond: 256 * 8 * 1024, // if this is provided, skip above two
        checkForInactiveTracks: true,
        timeSlice: 1000, // concatenate intervals based blobs
      };

      /* const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        options.sampleRate = 44100;
      } */

      recorder = new RecordRTC.MediaStreamRecorder(stream, options);
      recorder.record();
      videoSource.play();
      interval = setInterval(() => {
        recordingTime += 1;
      }, 1000);
    } catch (err) {
      alert(err);
    }
  }

  async function stop() {
    if (recorder) {
      recording = false;
      recorder.stop(
        (blob) => {
          turnOffAllDevices();
          videoBlob = blob;
          // checkBlobForUpload(blob, lexeme);
        },
        (err) => {
          turnOffAllDevices();
          alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
        }
      );
    }
    clearInterval(interval);
    recordingTime = 0;
    recordedVideo = true;
  }

  function turnOffAllDevices() {
    if (stream) {
      stream.getAudioTracks().forEach((track) => track.stop());
      stream.getVideoTracks().forEach((track) => track.stop());
    }
    stream = null;
    recorder = null;
  }
</script>

{#if videoBlob}
  <!-- svelte-ignore a11y-media-has-caption -->
  <video
    controls
    autoplay
    playsinline
    src={URL.createObjectURL(videoBlob)}
    class={recordedVideo ? 'visible w-full' : 'invisible w-0'} />
{/if}
<!-- svelte-ignore a11y-media-has-caption -->
<video bind:this={videoSource} class={recording ? 'visible w-full' : 'invisible w-0'} />
{#if !videoBlob}
  {#if !permissionGranted}
    {#if permissionDenied && RecordRTC}
      <div>
        {$_('audio.undo_permission_denied_explanation', {
          default:
            "Permission to access your microphone was denied. If you previously clicked 'No', please reload and click 'Yes' when your browser asks for permission to use your microphone.",
        })}
      </div>

      <div>
        <Button class="mt-1" size="sm" onclick={() => location.reload()}
          >{$_('audio.reload', { default: 'Reload' })}</Button>
        <Button
          size="sm"
          class="mt-1"
          form="simple"
          color="green"
          href="https://www.google.com/search?q=How+do+I+enable+microphone+access"
          target="_blank"
          rel="noopener">{$_('audio.learn_more', { default: 'Learn More' })}</Button>
      </div>
    {:else}
      <Button onclick={checkAudioPermissions} class="w-full">
        <i class="far fa-microphone-alt" />
        Prepare to Record with Microphone & Camera
      </Button>
    {/if}
  {:else if !recorder}
    <Button onclick={record} color="red" class="w-full h-24">
      {$_('audio.tap_to_record', { default: 'Tap to Record' })}
    </Button>
    <div class="text-gray-600 text-center text-xs mt-2">
      ({$_('audio.tapToStopRecording', { default: 'Then you will tap to stop recording' })})
    </div>
  {:else}
    <Button onclick={stop} color="red" class="w-full h-24">
      <div class="font-semibold font-mono text-2xl">{recordingTime}s</div>
      {$_('audio.stop_recording', { default: 'Stop Recording' })}
    </Button>
  {/if}
{:else}
  <div class="flex justify-between pt-2">
    <Button onclick={record} color="red">Record Again</Button>
    <Button onclick={uploadVideo} color="green">Upload</Button>
  </div>
{/if}

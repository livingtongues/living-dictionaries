<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Button from '$svelteui/ui/Button.svelte';

  export let audioBlob = null;
  export let permissionGranted = false;
  let permissionDenied = false;

  let RecordRTC: typeof import('recordrtc');
  import { onMount } from 'svelte';
  onMount(async () => {
    RecordRTC = (await import('recordrtc')).default;
    // Could also use `await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/RecordRTC/5.5.6/RecordRTC.js');` in context module block
  });

  // import type { StereoAudioRecorder } from 'recordrtc';
  // let recorder: StereoAudioRecorder = null;
  let recorder = null;
  let stream = null;

  async function checkAudioPermissions() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      permissionGranted = true;
      setTimeout(turnOffMic, 60);
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  let recordingTime = 0;
  let interval;

  async function record() {
    try {
      audioBlob = null;

      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      const options = {
        type: 'audio',
        mimeType: 'audio/wav',
        // bufferSize: 16384
        // the range is 22050 to 96000.
        sampleRate: 48000,
        // let us force 16khz recording:
        // desiblueSampRate: 16000,
        // numberOfAudioChannels: 2;
      };

      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      if (isSafari) {
        options.sampleRate = 44100;
      }

      recorder = new RecordRTC.StereoAudioRecorder(stream, options);
      recorder.record();

      interval = setInterval(() => {
        recordingTime += 1;
      }, 1000);
    } catch (err) {
      alert(err);
    }
  }

  async function stop() {
    if (recorder) {
      recorder.stop(
        (blob) => {
          turnOffMic();
          audioBlob = blob;
          // checkBlobForUpload(blob, lexeme);
        },
        (err) => {
          turnOffMic();
          alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
        }
      );
    }
    clearInterval(interval);
    recordingTime = 0;
  }

  function turnOffMic() {
    if (stream) {
      stream.getAudioTracks().forEach((track) => track.stop());
    }
    stream = null;
    recorder = null;
  }
</script>

{#if !audioBlob}
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
        {$_('audio.prepare_to_record', { default: 'Prepare to Record with Microphone' })}
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

  <!-- {:else}
  <div class="flex justify-center">
    <audio src={URL.createObjectURL(audioBlob)} controls />
  </div> -->
{/if}

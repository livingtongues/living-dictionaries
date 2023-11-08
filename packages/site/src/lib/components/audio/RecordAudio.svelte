<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from 'svelte-pieces';
  import { onMount } from 'svelte';
  import type { StereoAudioRecorder, Options } from 'recordrtc';

  export let audioBlob: Blob = null;
  export let permissionGranted = false;
  const permissionDenied = false;

  let RecordRTC: typeof import('recordrtc');
  onMount(async () => {
    RecordRTC = (await import('recordrtc')).default;
  // Could also use `await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/RecordRTC/5.5.6/RecordRTC.js');` in context module block
  });

  // let recorder: StereoAudioRecorder = null;
  let recorder: StereoAudioRecorder = null;
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
      alert(`${$page.data.t('misc.error')}: ${err}`);
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

      const options: Options = {
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
      if (isSafari)
        options.sampleRate = 44100;


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
        // @ts-ignore
        (err) => {
          turnOffMic();
          alert(`${$page.data.t('misc.error')}: ${err}`);
        }
      );
    }
    clearInterval(interval);
    recordingTime = 0;
  }

  function turnOffMic() {
    if (stream)
      stream.getAudioTracks().forEach((track) => track.stop());

    stream = null;
    recorder = null;
  }
</script>

{#if !audioBlob}
  {#if !permissionGranted}
    {#if permissionDenied && RecordRTC}
      <div>
        {$page.data.t('audio.undo_permission_denied_explanation')}
      </div>

      <div>
        <Button class="mt-1" size="sm" onclick={() => location.reload()}>{$page.data.t('audio.reload')}</Button>
        <Button
          size="sm"
          class="mt-1"
          form="simple"
          color="green"
          href="https://www.google.com/search?q=How+do+I+enable+microphone+access"
          target="_blank"
          rel="noopener">{$page.data.t('audio.learn_more')}</Button>
      </div>
    {:else}
      <Button onclick={checkAudioPermissions} class="w-full">
        <span class="i-uil-microphone" />
        {$page.data.t('audio.prepare_to_record')}
      </Button>
    {/if}
  {:else if !recorder}
    <Button onclick={record} color="red" class="w-full h-24">
      {$page.data.t('audio.tap_to_record')}
    </Button>
    <div class="text-gray-600 text-center text-xs mt-2">
      ({$page.data.t('audio.tapToStopRecording')})
    </div>
  {:else}
    <Button onclick={stop} color="red" class="w-full h-24">
      <div class="font-semibold font-mono text-2xl">{recordingTime}s</div>
      {$page.data.t('audio.stop_recording')}
    </Button>
  {/if}

  <!-- {:else}
  <div class="flex justify-center">
    <audio src={URL.createObjectURL(audioBlob)} controls />
  </div> -->
{/if}

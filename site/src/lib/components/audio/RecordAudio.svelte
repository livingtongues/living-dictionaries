<script lang="ts">
  import { onMount } from 'svelte'
  import type { Options, StereoAudioRecorder } from 'recordrtc'
  import { page } from '$app/state'
  import Button from '$lib/components/ui/Button.svelte'
  import IconUilMicrophone from '~icons/uil/microphone'

  interface Props {
    audioBlob?: Blob
    permissionGranted?: boolean
  }

  let { audioBlob = $bindable(null), permissionGranted = $bindable(false) }: Props = $props()
  const permissionDenied = false

  let RecordRTC: typeof import('recordrtc') = $state()
  onMount(async () => {
    RecordRTC = (await import('recordrtc')).default
  // Could also use `await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/RecordRTC/5.5.6/RecordRTC.js');` in context module block
  })

  // let recorder: StereoAudioRecorder = null;
  let recorder: StereoAudioRecorder = $state(null)
  let stream = null

  async function checkAudioPermissions() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })
      permissionGranted = true
      setTimeout(turnOffMic, 60)
    } catch (err) {
      alert(`${page.data.t('misc.error')}: ${err}`)
    }
  }

  let recordingTime = $state(0)
  let interval

  async function record() {
    try {
      audioBlob = null

      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      })

      const options: Options = {
        type: 'audio',
        mimeType: 'audio/wav',
        // bufferSize: 16384
        // the range is 22050 to 96000.
        sampleRate: 48000,
      // let us force 16khz recording:
        // desiblueSampRate: 16000,
        // numberOfAudioChannels: 2;
      }

      const isSafari = /^(?:(?!chrome|android).)*safari/i.test(navigator.userAgent)
      if (isSafari)
        options.sampleRate = 44100

      recorder = new RecordRTC.StereoAudioRecorder(stream, options)
      recorder.record()

      interval = setInterval(() => {
        recordingTime += 1
      }, 1000)
    } catch (err) {
      alert(err)
    }
  }

  function stop() {
    if (recorder) {
      recorder.stop(
        (blob) => {
          turnOffMic()
          audioBlob = blob
        // checkBlobForUpload(blob, lexeme);
        },
        // @ts-ignore
        (err) => {
          turnOffMic()
          alert(`${page.data.t('misc.error')}: ${err}`)
        },
      )
    }
    clearInterval(interval)
    recordingTime = 0
  }

  function turnOffMic() {
    if (stream)
      stream.getAudioTracks().forEach(track => track.stop())

    stream = null
    recorder = null
  }
</script>

{#if !audioBlob}
  {#if !permissionGranted}
    {#if permissionDenied && RecordRTC}
      <div>
        {page.data.t('audio.undo_permission_denied_explanation')}
      </div>

      <div>
        <Button class="record-spaced" size="sm" onclick={() => location.reload()}>{page.data.t('audio.reload')}</Button>
        <Button
          size="sm"
          class="record-spaced"
          form="simple"
          color="green"
          href="https://www.google.com/search?q=How+do+I+enable+microphone+access"
          target="_blank"
          rel="noopener">{page.data.t('audio.learn_more')}</Button>
      </div>
    {:else}
      <Button onclick={checkAudioPermissions} class="record-full">
        <IconUilMicrophone class="icon-inline" />
        {page.data.t('audio.prepare_to_record')}
      </Button>
    {/if}
  {:else if !recorder}
    <Button onclick={record} color="red" class="record-full record-tall">
      {page.data.t('audio.tap_to_record')}
    </Button>
    <div class="record-hint">
      ({page.data.t('audio.tapToStopRecording')})
    </div>
  {:else}
    <Button onclick={stop} color="red" class="record-full record-tall">
      <div class="recording-time">{recordingTime}s</div>
      {page.data.t('audio.stop_recording')}
    </Button>
  {/if}

  <!-- {:else}
  <div class="flex justify-center">
    <audio src={URL.createObjectURL(audioBlob)} controls />
  </div> -->
{/if}

<style>
  :global(.record-spaced) {
    margin-top: 0.25rem;
  }

  :global(.record-full) {
    width: 100%;
  }

  :global(.record-tall) {
    height: 6rem;
  }

  .record-hint {
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    text-align: center;
    font-size: 0.75rem;
    line-height: 1rem;
    margin-top: 0.5rem;
  }

  .recording-time {
    font-weight: 600;
    font-family: var(--font-mono);
    font-size: 1.5rem;
    line-height: 2rem;
  }
</style>

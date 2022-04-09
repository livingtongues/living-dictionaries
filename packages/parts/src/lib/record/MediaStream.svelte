<script context="module" lang="ts">
  import { writable } from 'svelte/store';
  let selectedMicrophone = writable<MediaDeviceInfo>(null);
  let selectedCamera = writable<MediaDeviceInfo>(null);
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  export let audio = true,
    video = true;
  let stream: MediaStream;
  let devices: MediaDeviceInfo[] = [];
  $: microphones = devices.filter((d) => d.kind === 'audioinput');
  $: cameras = devices.filter((d) => d.kind === 'videoinput');
  $: {
    if (!$selectedMicrophone) {
      selectedMicrophone.set(microphones[0]);
    }
    if (!$selectedCamera) {
      selectedCamera.set(cameras[0]);
    }
  }

  let error: any;

  onMount(async () => {
    try {
      stream = await requestStream();
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (e) {
      error = { name: e.name, message: e.message };
      console.log(e.name + ': ' + e.message);
    }
  });

  function requestStream() {
    closeStream();
    const constraints: MediaStreamConstraints = {
      audio: audio
        ? {
            deviceId: $selectedMicrophone ? $selectedMicrophone.deviceId : undefined,
          }
        : false,
      video: video
        ? {
            deviceId: $selectedCamera ? $selectedCamera.deviceId : undefined,
          }
        : false,
    };
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  function closeStream() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
  }

  async function chooseMicrophone(microphoneId: string) {
    selectedMicrophone.set(microphones.find((m) => m.deviceId === microphoneId));
    stream = await requestStream();
  }
  async function chooseCamera(cameraId: string) {
    selectedCamera.set(cameras.find((c) => c.deviceId === cameraId));
    stream = await requestStream();
  }

  onDestroy(() => closeStream());
</script>

{#if stream}
  <slot
    {stream}
    {closeStream}
    {microphones}
    {cameras}
    {chooseMicrophone}
    {chooseCamera}
    selectedMicrophone={$selectedMicrophone}
    selectedCamera={$selectedCamera} />
{:else if error}
  {#if error.message === 'Permission dismissed'}
    <slot name="dismissed" />
  {:else if error.message === 'Permission denied'}
    <slot name="denied" />
  {:else}
    <slot name="error" message={error.message}>
      Error: {error.message}
    </slot>
  {/if}
{:else}
  <slot name="loading" />
{/if}

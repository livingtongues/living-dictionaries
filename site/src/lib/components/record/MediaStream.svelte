<script module lang="ts">
  import { writable } from 'svelte/store'

  const selectedMicrophone = writable<MediaDeviceInfo>(null)
  const selectedCamera = writable<MediaDeviceInfo>(null)
</script>

<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Snippet } from 'svelte'

  interface Props {
    audio?: boolean
    video?: boolean
    children?: Snippet<[{
      stream: MediaStream
      closeStream: () => void
      microphones: MediaDeviceInfo[]
      cameras: MediaDeviceInfo[]
      chooseMicrophone: (microphoneId: string) => Promise<void>
      chooseCamera: (cameraId: string) => Promise<void>
      selectedMicrophone: MediaDeviceInfo
      selectedCamera: MediaDeviceInfo
    }]>
    dismissed?: Snippet
    denied?: Snippet
    error_snippet?: Snippet<[{ message: string }]>
    loading?: Snippet
  }

  const { audio = true, video = true, children, dismissed, denied, error_snippet, loading }: Props = $props()

  let stream: MediaStream = $state()
  let devices: MediaDeviceInfo[] = $state([])
  const microphones = $derived(devices.filter(d => d.kind === 'audioinput'))
  const cameras = $derived(devices.filter(d => d.kind === 'videoinput'))
  $effect(() => {
    if (!$selectedMicrophone)
      selectedMicrophone.set(microphones[0])

    if (!$selectedCamera)
      selectedCamera.set(cameras[0])
  })

  let error: any = $state()

  onMount(async () => {
    try {
      stream = await requestStream()
      devices = await navigator.mediaDevices.enumerateDevices()
    } catch (e) {
      error = { name: e.name, message: e.message }
      console.error(`${e.name}: ${e.message}`)
    }
  })

  function requestStream() {
    closeStream()
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
    }
    return navigator.mediaDevices.getUserMedia(constraints)
  }

  function closeStream() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }
  }

  async function chooseMicrophone(microphoneId: string) {
    selectedMicrophone.set(microphones.find(m => m.deviceId === microphoneId))
    stream = await requestStream()
  }
  async function chooseCamera(cameraId: string) {
    selectedCamera.set(cameras.find(c => c.deviceId === cameraId))
    stream = await requestStream()
  }

  onDestroy(() => closeStream())
</script>

{#if stream}
  {@render children?.({
    stream,
    closeStream,
    microphones,
    cameras,
    chooseMicrophone,
    chooseCamera,
    selectedMicrophone: $selectedMicrophone,
    selectedCamera: $selectedCamera,
  })}
{:else if error}
  {#if error.message === 'Permission dismissed'}
    {@render dismissed?.()}
  {:else if error.message === 'Permission denied'}
    {@render denied?.()}
  {:else if error_snippet}
    {@render error_snippet({ message: error.message })}
  {:else}
    Error: {error.message}
  {/if}
{:else}
  {@render loading?.()}
{/if}

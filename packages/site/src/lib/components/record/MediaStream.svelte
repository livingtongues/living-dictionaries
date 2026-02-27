<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onDestroy, onMount } from 'svelte'

  let selected_microphone: MediaDeviceInfo = $state(null)
  let selected_camera: MediaDeviceInfo = $state(null)

  const { audio = true, video = true, children, dismissed, denied, error: error_snippet, loading }: {
    audio?: boolean
    video?: boolean
    children: Snippet<[{
      stream: MediaStream
      closeStream: () => void
      microphones: MediaDeviceInfo[]
      cameras: MediaDeviceInfo[]
      chooseMicrophone: (id: string) => void
      chooseCamera: (id: string) => void
      selectedMicrophone: MediaDeviceInfo
      selectedCamera: MediaDeviceInfo
    }]>
    dismissed?: Snippet
    denied?: Snippet
    error?: Snippet<[{ message: string }]>
    loading?: Snippet
  } = $props()

  let stream: MediaStream = $state(undefined)
  let devices: MediaDeviceInfo[] = $state([])
  let error_state: any = $state(undefined)

  const microphones = $derived(devices.filter(d => d.kind === 'audioinput'))
  const cameras = $derived(devices.filter(d => d.kind === 'videoinput'))

  $effect(() => {
    if (!selected_microphone && microphones.length)
      selected_microphone = microphones[0]
    if (!selected_camera && cameras.length)
      selected_camera = cameras[0]
  })

  onMount(async () => {
    try {
      stream = await requestStream()
      devices = await navigator.mediaDevices.enumerateDevices()
    } catch (e) {
      error_state = { name: e.name, message: e.message }
      console.error(`${e.name}: ${e.message}`)
    }
  })

  function requestStream() {
    closeStream()
    const constraints: MediaStreamConstraints = {
      audio: audio
        ? { deviceId: selected_microphone ? selected_microphone.deviceId : undefined }
        : false,
      video: video
        ? { deviceId: selected_camera ? selected_camera.deviceId : undefined }
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
    selected_microphone = microphones.find(m => m.deviceId === microphoneId)
    stream = await requestStream()
  }
  async function chooseCamera(cameraId: string) {
    selected_camera = cameras.find(c => c.deviceId === cameraId)
    stream = await requestStream()
  }

  onDestroy(() => closeStream())
</script>

{#if stream}
  {@render children({
    stream,
    closeStream,
    microphones,
    cameras,
    chooseMicrophone,
    chooseCamera,
    selectedMicrophone: selected_microphone,
    selectedCamera: selected_camera,
  })}
{:else if error_state}
  {#if error_state.message === 'Permission dismissed'}
    {#if dismissed}{@render dismissed()}{/if}
  {:else if error_state.message === 'Permission denied'}
    {#if denied}{@render denied()}{/if}
  {:else if error_snippet}
    {@render error_snippet({ message: error_state.message })}
  {:else}
    Error: {error_state.message}
  {/if}
{:else if loading}
  {@render loading()}
{/if}

<script lang="ts">
  import type RecordRTCType from 'recordrtc'
  import type { Options, State } from 'recordrtc'
  import type { Snippet } from 'svelte'
  import { onDestroy, onMount } from 'svelte'

  const { stream, options, children }: {
    stream: MediaStream
    options: Options
    children: Snippet<[{
      start: () => void
      pause: () => void
      stop: () => Promise<Blob>
      recorder: RecordRTCType
      recordingTime: number
      recording_state: State
    }]>
  } = $props()

  let RecordRTC_module: typeof RecordRTCType = $state(undefined)
  let recorder: RecordRTCType = $state(undefined)
  let recordingTime = $state(0)
  let interval
  let recording_state: State = $state(undefined)

  onMount(async () => {
    RecordRTC_module = (await import('recordrtc')).default
  })

  $effect(() => {
    if (RecordRTC_module) {
      if (recorder)
        recorder.stopRecording()

      recorder = new RecordRTC_module(stream, options)
      recording_state = recorder.getState()
    }
  })

  function start() {
    recorder.startRecording()
    recording_state = recorder.getState()
    startTimer()
  }

  function pause() {
    if (recording_state === 'recording') {
      recorder.pauseRecording()
      recording_state = recorder.getState()
      clearInterval(interval)
    } else if (recording_state === 'paused') {
      recorder.resumeRecording()
      recording_state = recorder.getState()
      startTimer()
    }
  }

  function stop(): Promise<Blob> {
    return new Promise((resolve) => {
      clearInterval(interval)
      recordingTime = 0
      recorder.stopRecording(() => {
        recording_state = recorder.getState()
        const blob = recorder.getBlob()
        resolve(blob)
      })
    })
  }

  function startTimer() {
    interval = setInterval(() => {
      recordingTime += 1
    }, 1000)
  }

  onDestroy(() => recorder?.stopRecording())
</script>

{@render children({ start, pause, stop, recorder, recordingTime, recording_state })}

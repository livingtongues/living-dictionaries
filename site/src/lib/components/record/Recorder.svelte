<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import type { Snippet } from 'svelte'
  import type RecordRTCType from 'recordrtc'

  import type { Options, State } from 'recordrtc'

  interface Props {
    stream: MediaStream
    options: Options
    children?: Snippet<[{
      start: () => void
      pause: () => void
      stop: () => Promise<Blob>
      recorder: RecordRTCType
      recordingTime: number
      state: State
    }]>
  }

  const { stream, options, children }: Props = $props()

  let RecordRTC = $state<typeof RecordRTCType>()
  let recorder = $state<RecordRTCType>()
  let recordingTime = $state(0)
  let interval
  let recorder_state = $state<State>()

  onMount(async () => {
    RecordRTC = (await import('recordrtc')).default // Will cause issues w/ making the window object exist and other SSR problems if imported server side
  })

  $effect(() => {
    if (RecordRTC) {
      const new_recorder = new RecordRTC(stream, options)
      recorder = new_recorder
      recorder_state = new_recorder.getState()
      return () => new_recorder.stopRecording()
    }
  })

  function start() {
    recorder.startRecording()
    recorder_state = recorder.getState()
    startTimer()
  }

  function pause() {
    if (recorder_state === 'recording') {
      recorder.pauseRecording()
      recorder_state = recorder.getState()
      clearInterval(interval)
    } else if (recorder_state === 'paused') {
      recorder.resumeRecording()
      recorder_state = recorder.getState()
      startTimer()
    }
  }

  function stop(): Promise<Blob> {
    return new Promise((resolve) => {
      clearInterval(interval)
      recordingTime = 0
      recorder.stopRecording(() => {
        recorder_state = recorder.getState()
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

  onDestroy(() => clearInterval(interval))
</script>

{@render children?.({ start, pause, stop, recorder, recordingTime, state: recorder_state })}

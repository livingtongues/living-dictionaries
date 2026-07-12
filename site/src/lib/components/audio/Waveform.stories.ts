import type { Story, StoryMeta } from 'svelte-look'
import type Component from './Waveform.svelte'

// Synthesize a short WAV (amplitude-modulated tone) as a data URL so the story
// needs no fixture file and works in both fetch-for-peaks and playback paths.
function make_wav_data_url(): string {
  const sample_rate = 8000
  const total_samples = sample_rate * 2
  const buffer = new ArrayBuffer(44 + total_samples * 2)
  const view = new DataView(buffer)

  const write_string = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i))
  }

  write_string(0, 'RIFF')
  view.setUint32(4, 36 + total_samples * 2, true)
  write_string(8, 'WAVE')
  write_string(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sample_rate, true)
  view.setUint32(28, sample_rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write_string(36, 'data')
  view.setUint32(40, total_samples * 2, true)

  for (let i = 0; i < total_samples; i++) {
    const time = i / sample_rate
    const envelope = Math.abs(Math.sin(time * Math.PI * 1.5)) * (0.3 + 0.7 * Math.abs(Math.sin(time * 7)))
    const sample = Math.sin(time * 220 * 2 * Math.PI) * envelope
    view.setInt16(44 + i * 2, sample * 0x7FFF, true)
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return `data:audio/wav;base64,${btoa(binary)}`
}

export const shared_meta: StoryMeta = {
  viewports: [{ width: 480, height: 120 }],
  csr: true,
}

export const FromUrl: Story<typeof Component> = {
  props: { audioUrl: make_wav_data_url() },
  interactions: async () => {
    // give decode + first canvas paint a beat
    await new Promise(resolve => setTimeout(resolve, 500))
  },
}

export const Playing: Story<typeof Component> = {
  props: { audioUrl: make_wav_data_url() },
  interactions: async (page) => {
    await page.click('button')
    await new Promise(resolve => setTimeout(resolve, 1000))
  },
}

import type { Story, StoryMeta } from 'svelte-look'
import type Component from './TimingsEditor.svelte'

// Synthesized 1.3s WAV as a data URI — svelte-look doesn't serve the app's
// static assets, and the editor decodes real bytes for the waveform.
function synth_wav_data_uri(): string {
  const sample_rate = 16000
  const seconds = 1.3
  const total = Math.floor(sample_rate * seconds)
  const data = new Int16Array(total)
  // Bursts of tone (word-like energy) separated by near-silence.
  const bursts = [[0, 0.3], [0.35, 0.6], [0.6, 0.8], [0.86, 1.1]]
  for (let i = 0; i < total; i++) {
    const t = i / sample_rate
    const in_burst = bursts.some(([from, to]) => t >= from && t < to)
    const amp = in_burst ? 0.6 : 0.02
    data[i] = Math.round(Math.sin(2 * Math.PI * 220 * t) * amp * (0.7 + 0.3 * Math.sin(2 * Math.PI * 7 * t)) * 32767)
  }
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const write_string = (offset: number, text: string) => [...text].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)))
  write_string(0, 'RIFF')
  view.setUint32(4, 36 + data.length * 2, true)
  write_string(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sample_rate, true)
  view.setUint32(28, sample_rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write_string(36, 'data')
  view.setUint32(40, data.length * 2, true)
  const bytes = new Uint8Array(44 + data.length * 2)
  bytes.set(new Uint8Array(header), 0)
  bytes.set(new Uint8Array(data.buffer), 44)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return `data:audio/wav;base64,${btoa(binary)}`
}

const wav_uri = synth_wav_data_uri()

const audio = {
  id: 'audio-1',
  timings: { s1: '0,300|50,250|0,200', s2: '60,240|' },
} as never

export const shared_meta: StoryMeta = {
  viewports: [
    { width: 900, height: 480 },
    { width: 390, height: 600 },
  ],
  csr: true, // waveform decode + drags live in $effect — SSR shows only the loading state
  page_data: {
    t: ((key: string) => key.split('.').pop()) as never,
    writes: { update_audio: async () => undefined } as never,
  },
}

export const TwoSentences: Story<typeof Component> = {
  props: {
    audio,
    audio_url: wav_uri,
    sentences: [
      { id: 's1', token_forms: ['我', '有', '好奇心'] },
      { id: 's2', token_forms: ['谢谢', '。'] },
    ],
    on_close: () => undefined,
  },
  interactions: async (page) => {
    await page.waitForSelector('.strip:not(.hidden)', { timeout: 10000 })
  },
}

export const NoTimings: Story<typeof Component> = {
  props: {
    audio: { id: 'audio-2', timings: null } as never,
    audio_url: wav_uri,
    sentences: [{ id: 's1', token_forms: ['hello'] }],
    on_close: () => undefined,
  },
}

// Adapted from tutor: site/src/lib/audio/waveform-utils.ts (which also has
// float32_to_audio_buffer + format_time if ever needed here)

export function get_peaks(buffer: Pick<AudioBuffer, 'getChannelData'>, num_buckets: number): number[] {
  const channel_data = buffer.getChannelData(0)
  const bucket_size = Math.floor(channel_data.length / num_buckets)
  const peaks: number[] = []

  for (let i = 0; i < num_buckets; i++) {
    const start = i * bucket_size
    const end = start + bucket_size
    let max = 0
    for (let j = start; j < end && j < channel_data.length; j++) {
      const absolute = Math.abs(channel_data[j])
      if (absolute > max)
        max = absolute
    }
    peaks.push(max)
  }

  return normalize_peaks(peaks)
}

function normalize_peaks(peaks: number[]): number[] {
  const max = Math.max(...peaks)
  if (max === 0)
    return peaks
  return peaks.map(peak => peak / max)
}

export async function decode_audio_buffer(audio: ArrayBuffer | Blob): Promise<AudioBuffer> {
  const audio_context = new AudioContext()
  try {
    if (audio instanceof Blob)
      audio = await audio.arrayBuffer()
    return await audio_context.decodeAudioData(audio)
  } finally {
    audio_context.close()
  }
}

if (import.meta.vitest) {
  describe(get_peaks, () => {
    it('extracts normalized max-amplitude buckets', () => {
      const samples = new Float32Array([0.1, -0.4, 0.2, 0.1, -0.8, 0.3, 0.05, 0.1])
      const fake_buffer = { getChannelData: () => samples }
      expect(get_peaks(fake_buffer, 2)).toEqual([0.5, 1])
    })

    it('returns zeros for silence', () => {
      const fake_buffer = { getChannelData: () => new Float32Array(8) }
      expect(get_peaks(fake_buffer, 2)).toEqual([0, 0])
    })
  })
}

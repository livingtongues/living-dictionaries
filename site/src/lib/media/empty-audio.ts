/**
 * Detects recordings that carry no audio samples. The browser recorder
 * (`RecordAudio.svelte` → RecordRTC StereoAudioRecorder, `audio/wav`) encodes
 * WAV client-side, so a mic that yields no data produces exactly a 44-byte
 * RIFF/WAVE header with a `data` chunk of size 0. 313 such files accumulated
 * 2018–2026 before this guard existed (they render as broken players) — better
 * nothing than a broken something.
 */

/** Header-only WAV is 44 bytes; nothing shorter can hold a sample either. */
export const MIN_AUDIO_UPLOAD_BYTES = 45

export function audio_has_no_samples(bytes: Uint8Array): boolean {
  if (bytes.length < MIN_AUDIO_UPLOAD_BYTES)
    return true
  return wav_data_chunk_is_empty(bytes)
}

/**
 * True ONLY when a RIFF/WAVE buffer positively contains a `data` chunk holding
 * zero sample bytes (the exact shape of the 313 broken production files).
 * Anything we can't read that conclusively — non-WAV bytes, a header stub with
 * no `data` chunk — returns false and makes no claim.
 */
export function wav_data_chunk_is_empty(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || !ascii_at(bytes, 0, 'RIFF') || !ascii_at(bytes, 8, 'WAVE'))
    return false
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Walk the chunk list — `data` isn't always at offset 36 (LIST/fact chunks precede it).
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, true)
    if (ascii_at(bytes, offset, 'data'))
      return size === 0 || bytes.length <= offset + 8
    offset += 8 + size + (size % 2) // chunks are word-aligned
  }
  return false
}

function ascii_at(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    if (bytes[offset + index] !== text.charCodeAt(index))
      return false
  }
  return true
}

if (import.meta.vitest) {
  function wav({ data_size, total_length }: { data_size: number, total_length?: number }): Uint8Array {
    const length = total_length ?? 44 + data_size
    const bytes = new Uint8Array(length)
    const view = new DataView(bytes.buffer)
    const write = (offset: number, text: string) => {
      for (let index = 0; index < text.length; index++)
        bytes[offset + index] = text.charCodeAt(index)
    }
    write(0, 'RIFF')
    view.setUint32(4, length - 8, true)
    write(8, 'WAVE')
    write(12, 'fmt ')
    view.setUint32(16, 16, true)
    write(36, 'data')
    view.setUint32(40, data_size, true)
    return bytes
  }

  test(wav_data_chunk_is_empty, () => {
    // the exact 44-byte shape of all 313 broken production files
    expect(wav_data_chunk_is_empty(wav({ data_size: 0 }))).toBe(true)
    expect(wav_data_chunk_is_empty(wav({ data_size: 1024 }))).toBe(false)
    // declared size but truncated body
    expect(wav_data_chunk_is_empty(wav({ data_size: 1024, total_length: 44 }))).toBe(true)
    // non-WAV bytes make no claim
    expect(wav_data_chunk_is_empty(new Uint8Array([0xFF, 0xFB, 0x92, 0x60]))).toBe(false)
    expect(wav_data_chunk_is_empty(new Uint8Array(0))).toBe(false)
    // a RIFF/WAVE header stub with no data chunk is inconclusive, not "empty"
    const stub = new Uint8Array(12)
    stub.set([0x52, 0x49, 0x46, 0x46], 0)
    stub.set([0x57, 0x41, 0x56, 0x45], 8)
    expect(wav_data_chunk_is_empty(stub)).toBe(false)
  })

  test(audio_has_no_samples, () => {
    expect(audio_has_no_samples(wav({ data_size: 0 }))).toBe(true)
    expect(audio_has_no_samples(wav({ data_size: 4096 }))).toBe(false)
    expect(audio_has_no_samples(new Uint8Array(10))).toBe(true)
    // a real mp3 frame is never flagged
    expect(audio_has_no_samples(new Uint8Array(2000).fill(0xFF))).toBe(false)
  })
}

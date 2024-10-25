import type { TablesUpdate } from '@living-dictionaries/types'
import { convert_speaker } from './convert-speakers'
import firebase_speakers from './speakers.json'

test(convert_speaker, () => {
  const converted_speakers: Record<string, TablesUpdate<'speakers'>> = {}
  for (const fb_speaker of firebase_speakers) {
    const { id, speaker } = convert_speaker(JSON.parse(JSON.stringify(fb_speaker)))
    const jacob_test_speaker_id = '2PELJgjxMHXEOcuZfv9MtGyiXdE3'
    if (id === jacob_test_speaker_id)
      continue
    converted_speakers[id] = speaker
  }
  expect(converted_speakers).toMatchFileSnapshot('converted-speakers.snap.json')
})

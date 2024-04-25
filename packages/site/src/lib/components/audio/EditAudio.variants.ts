import type { Variant, VariantMeta } from 'kitbook'
import type Component from './EditAudio.svelte'

export const shared_meta: VariantMeta = {
  // viewports: [
  //   { width: 500, height: 200 }
  // ]
}

const shared = {
  entry: {
    id: 'entry11',
    lexeme: 'Banana',
  },
  sound_file: null,
  on_close: () => console.info('closed'),
} satisfies Partial<Variant<Component>>

export const Has_Audio: Variant<Component> = {
  ...shared,
  sound_file: {
    fb_storage_path: 'iipay-aa/audio/o6TP02FiMiXSnedKo4kQ_1691957248951.mpeg',
    storage_url: 'https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/iipay-aa%2Faudio%2Fo6TP02FiMiXSnedKo4kQ_1691957248951.mpeg?alt=media',
    speaker_ids: ['1'],
  },
}

export const No_Audio: Variant<Component> = {
  ...shared,
}

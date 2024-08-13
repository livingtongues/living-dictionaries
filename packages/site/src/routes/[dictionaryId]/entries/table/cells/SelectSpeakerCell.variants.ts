import type { Variant, VariantMeta } from 'kitbook'
import type Component from './SelectSpeakerCell.svelte'

export const shared_meta: VariantMeta = {
  viewports: [
    { width: 160, height: 70 },
  ],
}

const shared = {
  speakers: [
    {
      displayName: 'Anatoli',
      id: '123',
    },
  ],
} satisfies Partial<Variant<Component>>

export const Normal: Variant<Component> = {
  ...shared,
  entry: {
    lexeme: 'test',
    sound_files: [
      { fb_storage_path: '', storage_url: '', speaker_ids: ['123'],
      },
    ],
  },
  can_edit: false,
}

export const Missing_Id: Variant<Component> = {
  ...shared,
  entry: {
    lexeme: 'test',
    sound_files: [
      { fb_storage_path: '', storage_url: '', speaker_ids: ['456'],
      },
    ],
  },
  can_edit: false,
}

export const Speaker_Name: Variant<Component> = {
  ...shared,
  entry: {
    lexeme: 'test',
    sound_files: [
      { fb_storage_path: '', storage_url: '', speakerName: 'María',
      },
    ],
  },
  can_edit: false,
}

export const Speaker_Name_And_Speaker_Id: Variant<Component> = {
  ...shared,
  entry: {
    lexeme: 'test',
    sound_files: [
      { fb_storage_path: '', storage_url: '', speakerName: 'Diego', speaker_ids: ['123'],
      },
    ],
  },
  can_edit: false,
}

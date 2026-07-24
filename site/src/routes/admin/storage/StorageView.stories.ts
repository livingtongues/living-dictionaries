import type { Story, StoryMeta } from 'svelte-look'
import type { AdminStorageResponseBody, StorageDictRow } from '../../api/admin/storage/+server'
import Component from './StorageView.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1000, height: 2000 }],
  csr: true,
}

function make_dict({ dict_id, name, bucket, audio_gb = 0, photo_gb = 0, video_gb = 0 }: {
  dict_id: string
  name: string
  bucket: string | null
  audio_gb?: number
  photo_gb?: number
  video_gb?: number
}): StorageDictRow {
  const variant_bytes = photo_gb * 0.25e9
  return {
    dict_id,
    name,
    bucket,
    audio_bytes: audio_gb * 1e9,
    video_bytes: video_gb * 1e9,
    photo_bytes: photo_gb * 1e9,
    total_bytes: (audio_gb + photo_gb + video_gb) * 1e9,
    variant_bytes,
    object_count: Math.round((audio_gb + photo_gb + video_gb) * 4000),
  }
}

const dicts: StorageDictRow[] = [
  make_dict({ dict_id: 'zapotec', name: 'Zapotec', bucket: 'public', audio_gb: 4.2, photo_gb: 2.1, video_gb: 0.8 }),
  make_dict({ dict_id: 'achi', name: 'Achi', bucket: 'public', audio_gb: 3.1, photo_gb: 1.4 }),
  make_dict({ dict_id: 'gta', name: 'GtaɁ', bucket: 'public', audio_gb: 2.6, photo_gb: 0.9, video_gb: 0.5 }),
  make_dict({ dict_id: 'siletz', name: 'Siletz Dee-ni', bucket: 'unlisted', audio_gb: 1.9, photo_gb: 0.6 }),
  make_dict({ dict_id: 'kihehe', name: 'Kihehe', bucket: 'unlisted', audio_gb: 1.1, photo_gb: 0.3 }),
  make_dict({ dict_id: 'sindarin', name: 'Sindarin', bucket: 'conlang', audio_gb: 0.9, photo_gb: 0.5 }),
  make_dict({ dict_id: 'klingon', name: 'Klingon', bucket: 'conlang', audio_gb: 0.4, photo_gb: 0.1 }),
  make_dict({ dict_id: 'bio-101', name: 'Biology 101 Glossary', bucket: 'glossary', audio_gb: 0.2 }),
  make_dict({ dict_id: 'old-test', name: 'Old test dict', bucket: 'delete', audio_gb: 0.7, photo_gb: 0.2 }),
  make_dict({ dict_id: 'hidden', name: 'Secure project', bucket: 'secure', audio_gb: 0.5 }),
  make_dict({ dict_id: 'stray', name: 'Never triaged', bucket: null, audio_gb: 0.3 }),
]

function sum(pick: (dict: StorageDictRow) => number): number {
  return dicts.reduce((total, dict) => total + pick(dict), 0)
}

const trend: AdminStorageResponseBody['trend'] = []
for (let month = 0; month < 93; month++) {
  const date = new Date(Date.UTC(2018, 9 + month, 28)).toISOString().slice(0, 10)
  const growth = (month + 1) / 93
  trend.push({ date, media_type: 'audio', bytes: sum(dict => dict.audio_bytes) * growth ** 1.4 })
  trend.push({ date, media_type: 'photo', bytes: sum(dict => dict.photo_bytes) * growth ** 2 })
  trend.push({ date, media_type: 'video', bytes: sum(dict => dict.video_bytes) * growth ** 3 })
}

const data: AdminStorageResponseBody = {
  generated_at: '2026-07-24T12:00:00Z',
  last_reconcile: '2026-07-24T10:50:00Z',
  totals: [
    { media_type: 'audio', bytes: sum(dict => dict.audio_bytes), object_count: 146726, variant_count: 0, variant_bytes: 0 },
    { media_type: 'photo', bytes: sum(dict => dict.photo_bytes), object_count: 21817, variant_count: 65451, variant_bytes: sum(dict => dict.variant_bytes) },
    { media_type: 'video', bytes: sum(dict => dict.video_bytes), object_count: 187, variant_count: 0, variant_bytes: 0 },
  ],
  orphaned: { bytes: 0, object_count: 0 },
  dicts,
  trend,
}

export const Default: Story<typeof Component> = {
  props: { data },
}

export const WithOrphans: Story<typeof Component> = {
  props: { data: { ...data, orphaned: { bytes: 412_000_000, object_count: 512 } } },
}

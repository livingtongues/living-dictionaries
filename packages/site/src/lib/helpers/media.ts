import { get } from 'svelte/store'
import type { ActualDatabaseEntry, GoalDatabaseVideo } from '@living-dictionaries/types'
import { deleteDocumentOnline, getDocument, set } from 'sveltefirets'
import { serverTimestamp } from 'firebase/firestore'
import type { ActualDatabaseVideo } from '@living-dictionaries/types/video.interface'
import { updateEntryOnline } from './entry/update'
import { goto } from '$app/navigation'
import { page } from '$app/stores'
import { upload_image } from '$lib/components/image/upload-image'
import { upload_audio } from '$lib/components/audio/upload-audio'

export function addImage(entryId: string, file: File) {
  const { data: { user }, params: { dictionaryId } } = get(page)
  const $user = get(user)
  const status = upload_image({ file, folder: `${dictionaryId}/images/${entryId}` })
  const unsubscribe = status.subscribe(async ({ storage_path, serving_url }) => {
    if (storage_path && serving_url) {
      await updateEntryOnline({ data: { pf: {
        path: storage_path,
        gcs: serving_url,
        ts: new Date().getTime(),
        cr: $user.displayName,
        ab: $user.uid,
      } }, entryId })
      unsubscribe()
    }
  })
  return status
}

export function addAudio({ entryId, speakerId, file }: { entryId: string, speakerId: string, file: File | Blob }) {
  const { data: { user }, params: { dictionaryId } } = get(page)
  const $user = get(user)
  const status = upload_audio({ file, folder: `${dictionaryId}/audio/${entryId}` })
  const unsubscribe = status.subscribe(async ({ storage_path }) => {
    if (storage_path) {
      await updateEntryOnline({ data: { sfs: [{
        path: storage_path,
        ts: new Date().getTime(),
        ab: $user.uid,
        sp: [speakerId],
      }] }, entryId })
      unsubscribe()
    }
  })
  return status
}

export async function deleteImage(entry: ActualDatabaseEntry) {
  await updateEntryOnline({ data: { pf: null }, entryId: entry.id })
}

export async function deleteAudio(entry: ActualDatabaseEntry) {
  await updateEntryOnline({ data: { sf: null, sfs: null }, entryId: entry.id })
}

export async function addVideo(entry_id: string, video: GoalDatabaseVideo) {
  await updateEntryOnline({ data: { vfs: [{ ...video, ts: Date.now() } as unknown as ActualDatabaseVideo] }, entryId: entry_id })
}

export async function deleteVideo(entry: ActualDatabaseEntry) {
  const [video] = entry.vfs
  const deletedVideo: GoalDatabaseVideo = {
    ...video,
    sp: Array.isArray(video.sp) ? video.sp : [video.sp],
    deleted: Date.now(),
  }
  await updateEntryOnline({ data: { vfs: null, deletedVfs: [...(entry.deletedVfs || []), deletedVideo] }, entryId: entry.id })
}

export async function deleteEntry(entry_id: string, dictionary_id: string, algoliaQueryParams: string) {
  const { data: { t } } = get(page)
  if (
    confirm(t('entry.delete_entry'))
  ) {
    try {
      const entry = await getDocument<ActualDatabaseEntry>(`dictionaries/${dictionary_id}/words/${entry_id}`)
      set<ActualDatabaseEntry>(`dictionaries/${dictionary_id}/deletedEntries/${entry.id}`, {
        ...entry,
        deletedAt: serverTimestamp(),
      }) // using cache based set to avoid conflicts w/ serverTimestamps loaded in from firestore normal and sent out via firestore lite, not awaiting in case internet is flaky - can go on to the delete operation.
      await deleteDocumentOnline(`dictionaries/${dictionary_id}/words/${entry.id}`)
      goto(`/${dictionary_id}/entries/list${algoliaQueryParams}`)
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }
}

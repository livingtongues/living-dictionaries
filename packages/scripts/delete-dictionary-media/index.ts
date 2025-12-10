import { program } from 'commander'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { GCLOUD_MEDIA_BUCKET_S3, admin_supabase, storage_bucket } from '../config-supabase'

// First do dry, then check, then live
// pnpm -F scripts delete-dictionary-media
// pnpm -F scripts delete-dictionary-media --live

program
  .option('-e, --environment [dev/prod]', 'Database Project', 'dev')
  .option('--live', 'By default only values are logged, run with live flag to delete media')
  .parse(process.argv)

const { live, environment } = program.opts()
await delete_dictionary_media({ live })

async function delete_dictionary_media({ live }: { live: boolean }) {
  if (live)
    console.log('Live run, media will be deleted!')
  else
    console.log('Dry run, no media will be deleted')

  console.log(`Deleting media-to-delete from ${environment}.`)
  const dateStamp = Date.now()

  const { data: media_to_delete, error } = await admin_supabase.from('media_to_delete').select()
  if (error) {
    console.error('Error fetching media to delete:', error)
    return
  }

  for (const media of media_to_delete) {
    if (live) {
      console.log(`Deleting media from ${media.dictionary_id}: ${media.storage_path}`)
      try {
        await GCLOUD_MEDIA_BUCKET_S3.send(new DeleteObjectCommand({
          Bucket: storage_bucket,
          Key: media.storage_path,
        }))
      } catch (error) {
        // @ts-expect-error
        if (error.Code === 'NoSuchKey') {
          console.log(`Media file not found, may have already been deleted: ${media.storage_path}`)
        } else {
          console.error(`Error deleting media from ${media.dictionary_id}: ${media.storage_path}`, error)
          throw error
        }
      }
      await admin_supabase.from('media_to_delete').delete().eq('id', media.id)
    } else {
      console.log(`Would delete from ${media.dictionary_id}: ${media.storage_path}`)
    }
  }

  console.log(
    `Finished ${live ? 'deleting' : 'emulating deleting'} ${media_to_delete.length} media items in ${(Date.now() - dateStamp) / 1000} seconds`,
  )
}

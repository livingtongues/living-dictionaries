import { program } from 'commander'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { GCLOUD_MEDIA_BUCKET_S3, admin_supabase, storage_bucket } from '../config-supabase'

program
  .option('-e, --environment [dev/prod]', 'Database Project', 'dev')
  .option('--id <value>', 'Dictionary Id')
  .option('--live', 'By default only values are logged, run with live flag to delete media')
  .parse(process.argv)

const { live, id: dictionary_id, environment } = program.opts()
await delete_dictionary_media({ dictionary_id, live })

async function delete_dictionary_media({ dictionary_id, live }: { dictionary_id: string, live: boolean }) {
  if (live)
    console.log('Live run, media will be deleted!')
  else
    console.log('Dry run, no media will be deleted')

  console.log(`Deleting media for ${dictionary_id} from ${environment}.`)
  const dateStamp = Date.now()

  const { data, error } = await admin_supabase.from('media_to_delete').select('*').eq('dictionary_id', dictionary_id)
  if (error) {
    console.error('Error fetching media to delete:', error)
    return
  }

  for (const media of data) {
    if (live) {
      console.log(`Deleting media: ${media.storage_path}`)
      await GCLOUD_MEDIA_BUCKET_S3.send(new DeleteObjectCommand({
        Bucket: storage_bucket,
        Key: media.storage_path,
      }))
      await admin_supabase.from('media_to_delete').delete().eq('id', media.id)
    } else {
      console.log(`Would delete: ${media.storage_path}`)
    }
  }

  console.log(
    `Finished ${live ? 'deleting' : 'emulating  '} media for dictionary ${dictionary_id} in ${(Date.now() - dateStamp) / 1000} seconds`,
  )
}

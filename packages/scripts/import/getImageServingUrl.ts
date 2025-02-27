import fetch from 'node-fetch'

import 'dotenv/config' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import

export async function getImageServingUrl(bucket_and_storage_path: string) {
  if (!process.env.ProcessImageUrl)
    throw new Error('Missing ProcessImageUrl, is it in your uncommitted .env file?')

  try {
    const imageServingUrlEndpoint = `${process.env.ProcessImageUrl}/${bucket_and_storage_path}`
    const res = await fetch(imageServingUrlEndpoint)
    const imageServingUrl = await res.text()
    return imageServingUrl.replace('http://lh3.googleusercontent.com/', '')
  } catch (error) {
    console.log(`Error getting serving url for ${bucket_and_storage_path}`)
    // @ts-ignore
    throw new Error(error)
  }
}

import fetch from 'node-fetch'
import { projectId } from '../config-firebase'

import 'dotenv/config' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import

export async function getImageServingUrl(imageStoragePath: string, environment: string) {
  if (!process.env.ProcessImageUrl)
    throw new Error('Missing ProcessImageUrl, is it in your uncommitted .env file?')

  try {
    const imageServingUrlEndpoint = `${process.env.ProcessImageUrl}/${projectId}.appspot.com/${imageStoragePath}`
    const res = await fetch(imageServingUrlEndpoint)
    const imageServingUrl = await res.text()
    return imageServingUrl.replace('http://lh3.googleusercontent.com/', '')
  } catch (error) {
    console.log(`Error getting serving url for ${imageStoragePath} on ${environment}`)
    // @ts-ignore
    throw new Error(error)
  }
}

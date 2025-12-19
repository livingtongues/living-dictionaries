import { decompressFromEncodedURIComponent as decode } from '$lib/lz/lz-string'
import type { RequestHandler } from './$types'
import { component_to_png } from './component-to-png'
import OpenGraphImage from './OpenGraphImage.svelte'

const HEIGHT = 630
const WIDTH = 1200

export const GET: RequestHandler = ({ url }) => {
  const props = JSON.parse(decode(url.searchParams.get('props')))
  return component_to_png(OpenGraphImage, props, props.height || HEIGHT, props.width || WIDTH)
}

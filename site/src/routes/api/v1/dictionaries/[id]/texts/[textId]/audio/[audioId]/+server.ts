import { make_media_delete_handler, make_media_timings_patch_handler } from '$lib/api/v1/media-route-handlers'

export const DELETE = make_media_delete_handler('audio:text')
export const PATCH = make_media_timings_patch_handler('audio:text')

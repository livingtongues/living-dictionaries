import type { AudioGenerateDerivativeRequestBody, AudioGenerateDerivativeResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_audio_generate_derivative(body: AudioGenerateDerivativeRequestBody) {
  return await post_request<AudioGenerateDerivativeRequestBody, AudioGenerateDerivativeResponseBody>('/api/audio/generate-derivative', body)
}

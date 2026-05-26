import type { DevSeedTestDictRequestBody, DevSeedTestDictResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

/** Dev-only — uses the session cookie automatically (same-origin fetch). */
export async function api_dev_seed_test_dict(body: DevSeedTestDictRequestBody) {
  return await post_request<DevSeedTestDictRequestBody, DevSeedTestDictResponseBody>(
    '/api/dev/seed-test-dict',
    body,
  )
}

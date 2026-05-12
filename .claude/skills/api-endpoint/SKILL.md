---
name: api-endpoint
description: Critical instructions on how to create and test SvelteKit API endpoints
---

## When to use me

When creating, modifying, or testing SvelteKit API endpoints (`+server.ts` files) in `new-site/`.

## Key Rule: Always Use _call Files

**Every API endpoint must have a companion `_call.ts` (or `_call.svelte.ts`) file.** Client-side code must **never** call `fetch('/api/...')` directly — always import and call the function from the `_call` file. This ensures:
- Type-safe request/response contracts
- Automatic auth header attachment (via `post_request`/`get_request`)

For streaming SSE endpoints, see [STREAMING.md](./STREAMING.md).

## Endpoint Structure

Interface names are derived by PascalCasing the route path segments after `api/`. For `routes/api/foo/bar/+server.ts` → `FooBar`, `routes/api/auth/email/verify/+server.ts` → `AuthEmailVerify`, etc:

```ts
import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'

export interface FooBarRequestBody {
  email: string
}

export interface FooBarResponseBody {
  result: 'success'
}

export const POST: RequestHandler = async ({ request }) => {
  // auth-gate endpoints that hit the DB or admin-only actions
  const { user_id } = await verify_auth(request)

  const { email } = await request.json() as FooBarRequestBody
  if (!email)
    error(ResponseCodes.BAD_REQUEST, 'No email provided')

  try {
    // ... your logic here
    return json({ result: 'success' } satisfies FooBarResponseBody)
  } catch (err) {
    console.error(`Error: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error: ${err.message}`)
  }
}
```

Key details:
- Always use `ResponseCodes` from `$lib/constants` (OK, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, INTERNAL_SERVER_ERROR)
- Always use `satisfies` when returning JSON for type checking
- Use `verify_auth(request)` from `$lib/auth/verify` for auth — extracts the Bearer token from the `Authorization` header and returns `{ user_id, email, name }`

## Companion _call.ts File

Place alongside `+server.ts`. Auth is handled automatically by `post_request`/`get_request` — the `_call` file just passes business data:

```ts
// routes/api/foo/bar/_call.ts
import type { FooBarRequestBody, FooBarResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_foo_bar(body: FooBarRequestBody) {
  return await post_request<FooBarRequestBody, FooBarResponseBody>('/api/foo/bar', body)
}
```

Callers get `{ data, error }`:
```ts
const { data, error } = await api_foo_bar({ email: 'user@example.com' })
if (error) {
  console.error(error.message)
  return
}
```

`post_request` and `get_request` in `$lib/utils/requests.ts` handle:
- JSON serialization and error response parsing
- Attaching `Authorization: Bearer <token>` from localStorage

---

## Testing

### Philosophy

**Test `_call.ts` files, not `+server.ts` directly.** This tests from the client's perspective and validates the full request/response cycle.

### File Structure

```
src/routes/api/foo/bar/
├── +server.ts       # Endpoint handler (not tested directly)
├── _call.ts         # Client functions (TEST THIS)
├── _call.test.ts    # Tests for the client
└── snapshots/       # File snapshots for large results
```

### Required Mocks

Every endpoint test needs these:

```ts
vi.mock('$app/environment', () => ({ dev: true }))

vi.mock('$lib/auth/verify', () => ({
  verify_auth: vi.fn((req: Request) => {
    const auth = req.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer '))
      throw Object.assign(new Error('Missing Authorization header'), { status: 401, body: { message: 'Missing Authorization header' } })
    const token = auth.replace('Bearer ', '')
    if (token === 'valid-token')
      return { user_id: 'test-user-id', email: 'test@test.com', name: 'Test' }
    throw Object.assign(new Error('Invalid or expired token'), { status: 401, body: { message: 'Invalid or expired token' } })
  }),
}))

vi.mock('$env/static/private', () => ({
  JWT_SECRET: 'test-jwt-secret',
}))
```

### Route Internal Calls Through the Endpoint

Mock `fetch` to route `/api/*` calls through the real endpoint handler and mock external API calls:

```ts
import { request } from '$lib/mocks/sveltekit-endpoint-helper'
import { POST } from './+server'

function setup_fetch_mock() {
  global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const url_string = url.toString()

    // Internal API calls go through the actual endpoint handler
    if (url_string.includes('/api/foo/bar')) {
      const body = options?.body ? JSON.parse(options.body as string) : null
      const headers: Record<string, string> = {}
      if (options?.headers) {
        const h = options.headers as Record<string, string>
        if (h.Authorization) headers.Authorization = h.Authorization
      }
      try {
        return await request(POST, { method: 'POST', body, headers })
      } catch (error: any) {
        if (error.status && error.body)
          return new Response(JSON.stringify(error.body), { status: error.status })
        throw error
      }
    }

    throw new Error(`Unmocked fetch: ${url_string}`)
  }) as typeof fetch
}
```

The `request` helper simulates SvelteKit's RequestEvent — see `new-site/src/lib/mocks/sveltekit-endpoint-helper.ts` (port from tutor/house when first endpoint test needs it).

### Always Test These Three Auth Scenarios

```ts
describe('authentication', () => {
  test('returns 401 when Authorization header is missing', async () => {
    await expect(() => request(POST, { body: { messages: [] } }))
      .rejects.toThrowErrorMatchingInlineSnapshot(`
        HttpError {
          "body": { "message": "Missing Authorization header" },
          "status": 401,
        }
      `)
  })

  test('returns 401 when token is invalid', async () => {
    await expect(() => request(POST, {
      headers: { Authorization: 'Bearer expired-token' },
      body: { messages: [] },
    }))
      .rejects.toThrowErrorMatchingInlineSnapshot(`
        HttpError {
          "body": { "message": "Invalid or expired token" },
          "status": 401,
        }
      `)
  })

  test('succeeds with valid token', async () => {
    const response = await request(POST, {
      headers: { Authorization: 'Bearer valid-token' },
      body: { messages: [{ role: 'user', content: 'Hello' }] },
    })
    expect(response.status).toBe(200)
  })
})
```

### Other Patterns

**Use `describe` with handler reference:**
```ts
import { POST, type FooBarRequestBody } from './+server'
describe(POST, () => {
  test('validates input', async () => {
    const body: FooBarRequestBody = { messages: [{ role: 'user', content: 'hello' }] }
    const response = await request(POST, {
      headers: { Authorization: 'Bearer valid-token' },
      body,
    })
  })
})
```

**Snapshots** — inline for small, file for large:
```ts
expect(data.text).toMatchInlineSnapshot(`"Hello world"`)
expect(data).toMatchFileSnapshot('./snapshots/chat-response.json')
// Update with: pnpm vitest -u
```

**Use `beforeEach`/`afterEach`** to reset fetch mock and localStorage between tests.

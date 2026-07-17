---
name: api-endpoint
description: Critical instructions on how to create and test SvelteKit API endpoints
---

## When to use me

When creating, modifying, or testing SvelteKit API endpoints (`+server.ts` files) in `site/`.

## Key rule: always use `_call` files

**Every API endpoint has a companion `_call.ts` (or `_call.svelte.ts`).** Client-side code must **never** call `fetch('/api/...')` directly — always import and call the function from the `_call` file. This gives you:

- Type-safe request/response contracts shared between client and server
- A single grep-able call site for every caller of an endpoint
- Consistent error handling via `post_request` / `get_request`
- Auth rides automatically on the httpOnly `session` cookie — no header wrangling

## Endpoint structure

Interface names are derived by PascalCasing the route path segments after `api/`. For `routes/api/foo/bar/+server.ts` → `FooBar`, `routes/api/me/profile/+server.ts` → `MeProfile`, etc:

```ts
import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface FooBarRequestBody {
  email: string
}

export interface FooBarResponseBody {
  result: 'success'
}

export const POST: RequestHandler = async (event) => {
  // auth-gate endpoints that hit the DB or perform privileged actions
  const { user_id } = await verify_auth(event)

  const { email } = await event.request.json() as FooBarRequestBody
  if (!email)
    error(ResponseCodes.BAD_REQUEST, 'No email provided')

  try {
    // ... your logic here
    return json({ result: 'success' } satisfies FooBarResponseBody)
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error: ${(err as Error).message}`)
  }
}
```

Key details:
- Use `ResponseCodes` from `$lib/constants` (`OK`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`, …) instead of magic numbers.
- Use `satisfies` when returning JSON for type-checking.
- Handlers take the full `event` (`RequestEvent`) — pass it to `verify_auth(event)` directly, then use `event.request.json()` for the body.

## Auth

Auth is cookie-first with an `Authorization: Bearer` fallback. Use the shape that matches the gate:

### `verify_auth` — any logged-in user
```ts
import { verify_auth } from '$lib/auth/verify'

const { user_id, email, name } = await verify_auth(event)
// throws 401 if the session cookie / bearer token is missing or invalid
```

`verify_auth(event)` reads the JWT from the httpOnly `session` cookie first, then falls back to `Authorization: Bearer <JWT>` (for non-browser callers). Returns `{ user_id, email, name }`.

### `verify_auth_dict_role` — per-dictionary contributor / manager actions
```ts
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'

const { user_id, email, role } = await verify_auth_dict_role(event, { dictionary, min_role: 'manager' })
// throws 401 on no auth, 403 on missing/insufficient role
// role: 'contributor' | 'manager' | 'admin' (LD has no 'editor' role)
```

Site admins (`admin_level >= 1`, derived from `site/src/lib/admins.ts`) bypass the per-dict role check entirely. The fresh DB lookup on every push ensures revocations are immediate — JWT-baked roles would let revoked editors keep pushing until token expiry.

## Companion `_call.ts` file

Place alongside `+server.ts`. Auth rides automatically on the `session` cookie — the `_call` file just passes business data:

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
console.log(data.result)
```

`post_request` / `get_request` in `$lib/utils/requests.ts`:
- Set `content-type: application/json`, JSON-serialize the body, parse the response
- Map non-2xx responses to `{ data: null, error: { status, message } }`
- Same-origin `fetch`, so the browser sends the httpOnly `session` cookie automatically — no Authorization header attachment needed

## Testing

### Philosophy

Test `+server.ts` **directly**: synthesize a `{ request, cookies }` event, sign a **real** JWT for the auth path, call the handler, and assert on the response AND the DB side-effect. Run against an in-memory `shared.db` so each test is isolated and the real migration runner exercises the real schema. **Don't mock `verify_auth`** — that hides bugs in the auth layer.

### File structure

```
src/routes/api/foo/bar/
├── +server.ts        # Endpoint handler (TEST THIS directly)
├── _call.ts          # Client function (thin; no separate test needed)
└── server.test.ts    # Tests against +server.ts
```

### Canonical test pattern (mirrors `api/auth/update-profile/server.test.ts`)

```ts
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

let db: ReturnType<typeof open_shared_db>

// Swap the server's shared-db singleton for a per-test in-memory DB
vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_shared_db(':memory:')          // runs all shared-migrations
  db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('user-1', 'user@example.com', 'Old Name', JSON.stringify([{ provider: 'email', provider_id: 'user@example.com' }]), '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')
})

afterEach(() => {
  db.close()
})

// Auth via a REAL signed JWT on the session cookie — exercises the real verify_auth
function call(body: unknown, options: { token?: string } = {}) {
  const request = new Request('http://localhost/api/foo/bar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const cookies = { get: (name: string) => (name === 'session' ? options.token : undefined) }
  return POST({ request, cookies } as unknown as Parameters<typeof POST>[0])
}

async function token(user_id = 'user-1', email = 'user@example.com') {
  return sign_jwt({ sub: user_id, email, name: 'Old Name' })
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ email: 'x@y.com' })).rejects.toMatchObject({ status: 401 })
  })

  test('400 on bad input', async () => {
    await expect(call({}, { token: await token() })).rejects.toMatchObject({ status: 400 })
  })

  test('happy path', async () => {
    const response = await call({ email: 'x@y.com' }, { token: await token() })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ result: 'success' })
  })
})
```

`error()` from `@sveltejs/kit` throws, so assert rejections with `.rejects.toMatchObject({ status })`.

### What to always test

1. **401** — no auth (missing cookie + missing header) and invalid token
2. **400** — bad/missing input (validation failures)
3. **Domain-specific 403 / 404 / 409** — role gates, FK lookups, uniqueness conflicts
4. **Happy path** — assert the response shape AND the DB side-effect (`SELECT` from the in-memory DB to confirm the write landed)

### Snapshots

Inline for small payloads, file for large:
```ts
expect(data).toMatchInlineSnapshot(`{ "result": "success" }`)
expect(big).toMatchFileSnapshot('./snapshots/response.json')
// Update with: pnpm --filter=site test -u
```

## LD-specific patterns

- **In-memory shared.db** with the real migration runner. For per-dict routes, use `open_shared_db(':memory:')` AND/OR a per-dict `:memory:` connection — see `src/routes/api/dictionary/[id]/db/server.test.ts` for the per-dict shape.
- For per-dict role-gated endpoints, mock the dict-role lookup OR insert a matching `dictionary_roles` row in the in-memory shared.db.
- **No `sveltekit-endpoint-helper` in `site/` yet** — tests synthesize `{ request, cookies }` directly. If a helper would simplify a batch of new tests, port one from house/tutor at that point.

## Reference: existing endpoints to model off

- `src/routes/api/auth/update-profile/` — simplest auth+update pattern (shared.db row update)
- `src/routes/api/dictionaries/create/` — auth + insert + uniqueness conflict (`409`)
- `src/routes/api/dictionaries/[id]/roles/` — dict-role-gated, manages `dictionary_roles`
- `src/routes/api/dictionary/[id]/db/` — per-dict push (write to dict.db, `verify_auth_dict_role`)
- `src/routes/api/dictionary/[id]/changes/` — per-dict pull (snapshot-aware delta)
- `src/routes/api/messages/reply/` — admin-only (`is_admin(email)` check), TipTap → email-out
- `src/routes/api/messages/assign/` — admin-only with ntfy push side-effect (silenced via `NTFY_DISABLED=1` in tests)

## Cross-references
- Auth: `site/src/lib/auth/verify.ts`, `verify-dict-role.ts`, `jwt.ts`; admin allow-list: `site/src/lib/admins.ts`
- Constants: `site/src/lib/constants.ts` (`ResponseCodes`)
- Request utils: `site/src/lib/utils/requests.ts`
- DB: `site/src/lib/db/server/shared-db.ts` (`open_shared_db`, `get_shared_db`)

---
name: api-endpoint
description: Create type-safe SvelteKit API endpoints with companion client call files
---

## When to use me

When creating new SvelteKit API endpoints (`+server.ts` files) or modifying existing ones.

## Key Patterns

### 1. Define Request/Response Interfaces

Always define and export typed interfaces at the top of your `+server.ts` file:

```typescript
export interface MyEndpointRequestBody {
  email: string
  some_id: string
}

export interface MyEndpointResponseBody {
  result: 'success'
  data?: SomeType
}
```

### 2. Structure Your Endpoint

```typescript
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { get_admin_supabase_client } from '$lib/supabase/admin'
import { error, json } from '@sveltejs/kit'

export interface MyEndpointRequestBody {
  email: string
}

export interface MyEndpointResponseBody {
  result: 'success'
}

export const POST: RequestHandler = async ({ request }) => {
  // 1. Parse and validate request body
  const { email } = await request.json() as MyEndpointRequestBody
  if (!email)
    error(ResponseCodes.BAD_REQUEST, 'No email provided')

  // 2. Use admin_supabase for admin operations
  const admin_supabase = get_admin_supabase_client()

  // 3. Perform operation with error handling
  try {
    // ... your logic here
    return json({ result: 'success' } satisfies MyEndpointResponseBody)
  } catch (err) {
    console.error(`Error: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error: ${err.message}`)
  }
}
```

### 3. When User Authentication is Needed

For operations that need the user's RLS context rather than admin access:

```typescript
export const POST: RequestHandler = async ({ request, locals: { getSession } }) => {
  const { data: session_data, error: _error, supabase } = await getSession()
  if (_error || !session_data?.user)
    error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  // Use supabase (not admin_supabase) for RLS-protected operations
  const { data } = await supabase.from('my_table').select('*')
}
```

### 4. Create Companion _call.ts File

Place a `_call.ts` file alongside your `+server.ts` for type-safe client calls:

```typescript
// routes/api/my-endpoint/_call.ts
import type { MyEndpointRequestBody, MyEndpointResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_my_endpoint(body: MyEndpointRequestBody) {
  return await post_request<MyEndpointRequestBody, MyEndpointResponseBody>('/api/my-endpoint', body)
}
```

This provides:
- Type safety between client and server
- Consistent error handling via `post_request`
- Easy imports from anywhere in the app

### 5. Use ResponseCodes Constants

Always use `ResponseCodes` from `$lib/constants` instead of magic numbers:
- `ResponseCodes.OK` (200)
- `ResponseCodes.BAD_REQUEST` (400)
- `ResponseCodes.UNAUTHORIZED` (401)
- `ResponseCodes.FORBIDDEN` (403)
- `ResponseCodes.NOT_FOUND` (404)
- `ResponseCodes.INTERNAL_SERVER_ERROR` (500)

### 6. Use `satisfies` for Type Checking

Always use `satisfies ResponseInterface` when returning JSON to catch type errors:

```typescript
return json({ result: 'success', data } satisfies MyEndpointResponseBody)
```

## Complete Example

### +server.ts
```typescript
import type { RequestHandler } from './$types'
import { dev } from '$app/environment'
import { ResponseCodes } from '$lib/constants'
import { send_email } from '$lib/email/send-email'
import { get_admin_supabase_client } from '$lib/supabase/admin'
import { error, json } from '@sveltejs/kit'

export interface OTPEmailRequestBody {
  email: string
}

export interface OTPEmailResponseBody {
  result: 'success'
  otp?: string
}

export const POST: RequestHandler = async ({ request }) => {
  const { email } = await request.json() as OTPEmailRequestBody
  if (!email)
    error(ResponseCodes.BAD_REQUEST, 'No email provided')

  const admin_supabase = get_admin_supabase_client()
  const { data, error: get_link_error } = await admin_supabase.auth.admin.generateLink({ email, type: 'magiclink' })
  if (get_link_error)
    error(500, get_link_error)

  if (dev)
    return json({ result: 'success', otp: data.properties.email_otp } satisfies OTPEmailResponseBody)

  try {
    await send_email({
      to: [{ email }],
      subject: 'Your One-Time Passcode',
      body: `${data.properties.email_otp} is your one-time passcode.`,
      type: 'text/plain',
    })
    return json({ result: 'success' } satisfies OTPEmailResponseBody)
  } catch (err) {
    console.error(`Error with email send request: ${err.message}`)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, `Error with email send request: ${err.message}`)
  }
}
```

### _call.ts
```typescript
import type { OTPEmailRequestBody, OTPEmailResponseBody } from './+server'
import { post_request } from '$lib/utils/requests'

export async function api_email_otp(body: OTPEmailRequestBody) {
  return await post_request<OTPEmailRequestBody, OTPEmailResponseBody>('/api/email/otp', body)
}
```

## post_request Helper

The `post_request` helper in `$lib/utils/requests.ts` handles:
- JSON serialization
- Error response parsing
- Base URL handling for mobile app to use production server URLs when needed

Returns `{ data, error }` pattern for consistent error handling:
```typescript
const { data, error } = await api_email_otp({ email: 'user@example.com' })
if (error) {
  console.error(error.message)
}
// Use data safely here
```

---
name: testing-api-endpoints
description: Testing SvelteKit API endpoints with Vitest and mock fetch
---

## Overview

This skill covers testing SvelteKit API endpoints by testing the **client `_call` files** (not `+server.ts` directly). This approach:
- Tests from the client's perspective, catching integration issues
- Routes internal API calls through the real endpoint handler
- Mocks only external API calls (e.g., xAI, OpenAI)
- Validates the full request/response cycle as users experience it

Key tools:
- A custom `request` helper to simulate SvelteKit's RequestEvent
- Mock Supabase auth via `vi.mock` for `access_token` validation
- Mock external APIs by mocking global `fetch` directly with Vitest

## Getting Real Response Formats for Mocks

Before writing tests, create a simple throwaway script to capture the real response format from external APIs. This ensures your mocks accurately reflect the actual API responses.

**Steps:**
1. Create a temporary file (e.g., `_throwaway-test.ts`) in the endpoint directory
2. Call the real external API (assumes .env keys are already configured)
3. Log the full response structure
4. Use the returned values to shape your mocks
5. Delete the throwaway file after capturing the response format

**Example throwaway script:**
```ts
// _throwaway-test.ts - Delete after capturing response format
// Run with: npx tsx src/routes/api/generate-text/_throwaway-test.ts

import { createXai } from '@ai-sdk/xai'
import { generateText } from 'ai'

const XAI_API_KEY = process.env.XAI_API_KEY
if (!XAI_API_KEY) {
  console.error('XAI_API_KEY not found in environment')
  process.exit(1)
}

async function test() {
  const xai = createXai({ apiKey: XAI_API_KEY })
  
  const result = await generateText({
    model: xai('grok-4-fast-non-reasoning'),
    prompt: 'Say hello in one word',
    maxOutputTokens: 10,
  })

  console.log('=== Full Result Object ===')
  console.log(JSON.stringify(result, null, 2))
}

test().catch(console.error)
```

**Running the script:**
```bash
cd app && XAI_API_KEY=$(grep '^XAI_API_KEY=' .env | cut -d'=' -f2-) npx tsx src/routes/api/generate-text/_throwaway-test.ts
```

This approach ensures mocks match real API behavior rather than assumed/outdated formats.

## Vitest Configuration

```ts
// vitest.config.ts
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineProject } from 'vitest/config'

export default defineProject({
  plugins: [svelte()],
  test: {
    alias: {
      $lib: new URL('./src/lib', import.meta.url).pathname,
      $api: new URL('./src/routes/api', import.meta.url).pathname,
    },
    name: 'unit',
    globals: true,
    includeSource: ['src/**/*.ts'],
    include: ['src/**/*.test.ts'],
  },
})
```


## Testing Philosophy: Test the Client, Not the Server

**Always test `_call.ts` files, not `+server.ts` directly.**

Why? Testing from the client's perspective:
1. Catches integration issues between client and server code
2. Tests the actual API contract users depend on
3. Validates error handling as the UI will experience it
4. Ensures the full request/response cycle works correctly

### File Structure

```
src/routes/api/xai/chat/
├── +server.ts      # Endpoint handler (not tested directly)
├── _call.ts        # Client functions (TEST THIS)
└── _call.test.ts   # Tests for the client
```

### The Key Pattern: Route Internal Calls Through the Endpoint

Mock `fetch` to:
1. Route `/api/*` calls through the real endpoint handler
2. Mock external API calls (xAI, OpenAI, etc.) with fake responses

```ts
import { request } from '$lib/mocks/sveltekit-endpoint-helper'
import { POST } from './+server'
import { api_xai_chat, ChatStreamer } from './_call'

function setup_fetch_mock() {
  global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const url_string = url.toString()

    // Internal API calls go through the actual endpoint handler
    if (url_string.includes('/api/xai/chat')) {
      const body = options?.body ? JSON.parse(options.body as string) : null
      try {
        return await request(POST, { method: 'POST', body })
      } catch (error: any) {
        // Convert SvelteKit HttpError to Response
        if (error.status && error.body) {
          return new Response(JSON.stringify(error.body), { status: error.status })
        }
        throw error
      }
    }

    // External xAI API calls get mocked
    if (url_string.includes('api.x.ai')) {
      return new Response(JSON.stringify({ /* mock response */ }))
    }

    throw new Error(`Unmocked fetch: ${url_string}`)
  }) as typeof fetch
}

beforeEach(() => {
  setup_fetch_mock()
})
```

This pattern lets you test `api_xai_chat()` and `ChatStreamer` as users would use them, while the real endpoint handler processes the requests.


## Core Helper: Request Function

This helper simulates SvelteKit's RequestEvent for testing endpoints:

```ts
// src/lib/mocks/sveltekit-endpoint-helper.ts
import type { MaybePromise } from '@sveltejs/kit'

interface RequestOptions {
  params?: Record<string, string>
  method?: 'POST' | 'GET'
  url?: {
    origin?: string
    path?: string
    query?: Record<string, string>
  }
  headers?: Record<string, string>
  body?: Record<string, any>
}

export function request(handler, options: RequestOptions = {}): MaybePromise<Response> {
  const params = options.params || {}
  const method = options.method || 'GET'
  const origin = options.url?.origin || 'http://localhost'
  const path = options.url?.path || '/'
  const url = new URL(path, origin)
  const headers = new Map<string, string>()
  const body = options.body || null

  const request = {
    headers,
    method,
    async json() { return body },
  }
  const event = { params, request, url }

  if (options.url?.query) {
    for (const [key, value] of Object.entries(options.url.query))
      url.searchParams.set(key, value)
  }
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers))
      headers.set(key, value)
  }

  return handler(event)
}
```


## Mocking Supabase Auth

Our endpoints use `access_token` in the request body, validated via `get_supabase().auth.getUser()`. Mock the entire `$lib/supabase` module:

```ts
// In your test file
import type { User } from '@supabase/supabase-js'

const mock_user: User = {
  id: 'test-user-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  created_at: '2024-01-01T00:00:00.000Z',
}

vi.mock('$lib/supabase', () => ({
  get_supabase: () => ({
    auth: {
      getUser: vi.fn((token: string) => {
        if (token === 'valid-token') {
          return Promise.resolve({ data: { user: mock_user }, error: null })
        }
        return Promise.resolve({ 
          data: { user: null }, 
          error: { message: 'Invalid token' } 
        })
      }),
    },
  }),
}))
```

## Testing Authentication

Always test these three auth scenarios:

```ts
describe('authentication', () => {
  test('returns 401 when access_token is missing', async () => {
    const body = { messages: [{ role: 'user', content: 'Hello' }] }
    await expect(() => request(POST, { body }))
      .rejects.toThrowErrorMatchingInlineSnapshot(`
        HttpError {
          "body": {
            "message": "access_token is required",
          },
          "status": 401,
        }
      `)
  })

  test('returns 401 when access_token is empty', async () => {
    const body = { access_token: '', messages: [{ role: 'user', content: 'Hello' }] }
    await expect(() => request(POST, { body }))
      .rejects.toThrowErrorMatchingInlineSnapshot(`
        HttpError {
          "body": {
            "message": "access_token is required",
          },
          "status": 401,
        }
      `)
  })

  test('returns 401 when access_token is invalid/expired', async () => {
    const body = { access_token: 'expired-token', messages: [{ role: 'user', content: 'Hello' }] }
    await expect(() => request(POST, { body }))
      .rejects.toThrowErrorMatchingInlineSnapshot(`
        HttpError {
          "body": {
            "message": "Invalid or expired token",
          },
          "status": 401,
        }
      `)
  })

  test('succeeds with valid access_token', async () => {
    const body = { access_token: 'valid-token', messages: [{ role: 'user', content: 'Hello' }] }
    const response = await request(POST, { body })
    expect(response.status).toBe(200)
  })
})
```


## Mocking External APIs with Fetch

Mock `fetch` directly using Vitest.

### Basic Fetch Mock

```ts
const original_fetch = global.fetch

beforeEach(() => {
  global.fetch = vi.fn((url: string | URL, options?: RequestInit) => {
    const url_string = url.toString()
    
    // Mock xAI API
    if (url_string.includes('api.x.ai')) {
      return Promise.resolve(new Response(JSON.stringify({
        output: [{
          type: 'message',
          content: [{ type: 'output_text', text: 'Mocked response' }]
        }]
      }), { status: 200 }))
    }
    
    // Let other requests through (or fail them)
    return Promise.reject(new Error(`Unmocked fetch: ${url_string}`))
  }) as typeof fetch
})

afterEach(() => {
  global.fetch = original_fetch
})
```

### Mocking Error Responses from External APIs

Test that specific errors from external services (rate limits, quota exceeded, etc.) are passed through to the client:

```ts
test('passes through rate limit error from xAI', async () => {
  global.fetch = vi.fn(async () => {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded. Please try again later.'
    }), { status: 429 })
  }) as typeof fetch

  const body = { access_token: 'valid-token', messages: [{ role: 'user', content: 'Hello' }] }
  await expect(() => request(POST, { body }))
    .rejects.toThrowErrorMatchingInlineSnapshot(`
      HttpError {
        "body": {
          "message": "Rate limit exceeded. Please try again later.",
        },
        "status": 429,
      }
    `)
})

test('passes through quota exceeded error from xAI', async () => {
  global.fetch = vi.fn(async () => {
    return new Response(JSON.stringify({
      error: 'Insufficient credits. Please upgrade your plan.'
    }), { status: 402 })
  }) as typeof fetch

  const body = { access_token: 'valid-token', messages: [{ role: 'user', content: 'Hello' }] }
  await expect(() => request(POST, { body }))
    .rejects.toThrowErrorMatchingInlineSnapshot(`
      HttpError {
        "body": {
          "message": "Insufficient credits. Please upgrade your plan.",
        },
        "status": 402,
      }
    `)
})

test('passes through service unavailable error', async () => {
  global.fetch = vi.fn(async () => {
    return new Response(JSON.stringify({
      error: 'Service temporarily unavailable'
    }), { status: 503 })
  }) as typeof fetch

  const body = { access_token: 'valid-token', messages: [{ role: 'user', content: 'Hello' }] }
  await expect(() => request(POST, { body }))
    .rejects.toThrowErrorMatchingInlineSnapshot(`
      HttpError {
        "body": {
          "message": "Service temporarily unavailable",
        },
        "status": 503,
      }
    `)
})
```

**Important**: Your endpoint should extract and pass through the error message from the external API response:

```ts
// In +server.ts
const xai_response = await fetch(XAI_API_URL, { ... })

if (!xai_response.ok) {
  const err = await xai_response.json().catch(() => ({ error: 'Unknown error' }))
  error(xai_response.status, err.error || `xAI API error: ${xai_response.status}`)
}
```

### Mocking Streaming Responses

```ts
function create_mock_sse_stream(events: Array<{ event: string, data: any }>) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const { event, data } of events) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      controller.close()
    },
  })
}

// In your mock:
if (url_string.includes('api.x.ai') && body?.stream) {
  const stream = create_mock_sse_stream([
    { event: 'delta', data: { text: 'Hello ' } },
    { event: 'delta', data: { text: 'world!' } },
    { event: 'done', data: { text: 'Hello world!', citations: [] } },
  ])
  return Promise.resolve(new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  }))
}
```


## Complete Test Example (Client-Focused)

Here's a full example testing an xAI chat client that routes through the real endpoint:

```ts
// src/routes/api/xai/chat/_call.test.ts
import { request } from '$lib/mocks/sveltekit-endpoint-helper'
import { ACCESS_TOKEN_NAME } from '$lib/supabase/constants'
import { POST } from './+server'
import { api_xai_chat, ChatStreamer } from './_call'

vi.mock('$env/static/private', () => ({
  XAI_API_KEY: 'test-xai-key',
}))

vi.mock('$lib/supabase', () => ({
  get_supabase: () => ({
    auth: {
      getUser: vi.fn((token: string) => {
        if (token === 'valid-token') {
          return Promise.resolve({ 
            data: { user: { id: 'user-1', email: 'test@test.com' } }, 
            error: null 
          })
        }
        return Promise.resolve({ data: { user: null }, error: { message: 'Invalid' } })
      }),
    },
  }),
}))

const original_fetch = global.fetch

// Mock xAI response format
function create_mock_xai_response(text: string) {
  return {
    output: [{
      type: 'message',
      content: [{ type: 'output_text', text, annotations: [] }],
      role: 'assistant',
    }],
    usage: { input_tokens: 10, output_tokens: 5 },
  }
}

// Route internal API calls through endpoint, mock external calls
function setup_fetch_mock() {
  global.fetch = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const url_string = url.toString()

    // Internal API calls go through the actual endpoint handler
    if (url_string.includes('/api/xai/chat')) {
      const body = options?.body ? JSON.parse(options.body as string) : null
      try {
        return await request(POST, { method: 'POST', body })
      } catch (error: any) {
        if (error.status && error.body) {
          return new Response(JSON.stringify(error.body), { status: error.status })
        }
        throw error
      }
    }

    // External xAI API calls get mocked
    if (url_string.includes('api.x.ai')) {
      return new Response(JSON.stringify(create_mock_xai_response('Hello world')))
    }

    throw new Error(`Unmocked fetch: ${url_string}`)
  }) as typeof fetch
}

// Mock localStorage for access token
const mock_storage: Record<string, string> = {}
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => mock_storage[key] ?? null,
    setItem: (key: string, value: string) => { mock_storage[key] = value },
    removeItem: (key: string) => { delete mock_storage[key] },
    clear: () => { Object.keys(mock_storage).forEach(key => delete mock_storage[key]) },
  },
  writable: true,
})

beforeEach(() => {
  setup_fetch_mock()
  Object.keys(mock_storage).forEach(key => delete mock_storage[key])
})

afterEach(() => {
  global.fetch = original_fetch
})

describe(api_xai_chat, () => {
  test('throws when not authenticated', async () => {
    await expect(api_xai_chat({
      messages: [{ role: 'user', content: 'Hello' }],
    })).rejects.toThrow('Not authenticated')
  })

  test('returns error when token is invalid', async () => {
    mock_storage[ACCESS_TOKEN_NAME] = 'invalid-token'

    const result = await api_xai_chat({
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result.error?.status).toBe(401)
    expect(result.error?.message).toBe('Invalid or expired token')
  })

  test('returns chat response with valid token', async () => {
    mock_storage[ACCESS_TOKEN_NAME] = 'valid-token'

    const result = await api_xai_chat({
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result.error).toBeNull()
    expect(result.data?.text).toBe('Hello world')
  })
})

describe(ChatStreamer, () => {
  test('streams response with valid token', async () => {
    mock_storage[ACCESS_TOKEN_NAME] = 'valid-token'
    const streamer = new ChatStreamer()

    const { text } = await streamer.send({
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(streamer.error).toBeNull()
    expect(streamer.is_loading).toBeFalsy()
    expect(text).toBe('Hello world')
  })

  test('is_loading is true during request', async () => {
    mock_storage[ACCESS_TOKEN_NAME] = 'valid-token'

    // Create a slow stream to observe is_loading state
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      if (url.toString().includes('/api/xai/chat')) {
        await new Promise(resolve => setTimeout(resolve, 10))
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('event: delta\ndata: {"text":"Hi"}\n\n'))
            controller.enqueue(encoder.encode('event: done\ndata: {"text":"Hi","citations":[]}\n\n'))
            controller.close()
          },
        })
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
      }
      throw new Error(`Unmocked: ${url}`)
    }) as typeof fetch

    const streamer = new ChatStreamer()
    expect(streamer.is_loading).toBeFalsy()

    const promise = streamer.send({ messages: [{ role: 'user', content: 'Hello' }] })
    expect(streamer.is_loading).toBeTruthy()

    await promise
    expect(streamer.is_loading).toBeFalsy()
  })
})
```


## Testing Streaming Endpoints

When testing streaming, you may need to mock at different levels:

### Mock External API Stream (for endpoint tests)

```ts
test('streams response when stream=true', async () => {
  global.fetch = vi.fn(async (url: string | URL, options?: RequestInit) => {
    if (url.toString().includes('api.x.ai')) {
      const body = JSON.parse(options?.body as string)
      if (body.stream) {
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            // Simulate xAI streaming format
            controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Hello "}\n'))
            controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"world!"}\n'))
            controller.enqueue(encoder.encode('data: {"type":"response.done","response":{"output":[]}}\n'))
            controller.close()
          },
        })
        return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
      }
    }
    throw new Error(`Unmocked: ${url}`)
  }) as typeof fetch

  // ... test the endpoint
})
```

### Mock Server Stream Directly (for client behavior tests)

When testing how the client handles specific SSE events (like error events), mock the endpoint directly instead of going through the server:

```ts
// Create a server-transformed stream that sends an error event mid-stream
function create_server_stream_with_error(partial_text: string, error_message: string) {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: delta\ndata: {"text":"${partial_text}"}\n\n`))
      controller.enqueue(encoder.encode(`event: error\ndata: {"message":"${error_message}"}\n\n`))
      controller.close()
    },
  })
}

test('handles error event during stream', async () => {
  mock_storage[ACCESS_TOKEN_NAME] = 'valid-token'
  
  // Mock the endpoint directly to test client error handling
  global.fetch = vi.fn((url: string | URL | Request) => {
    if (url.toString().includes('/api/xai/chat')) {
      return Promise.resolve(new Response(
        create_server_stream_with_error('Partial response', 'Content policy violation'),
        { headers: { 'Content-Type': 'text/event-stream' } }
      ))
    }
    throw new Error(`Unmocked: ${url}`)
  }) as typeof fetch

  const streamer = new ChatStreamer()
  await streamer.send({ messages: [{ role: 'user', content: 'Hello' }] })

  expect(streamer.error).toBe('Content policy violation')
  expect(streamer.result).toBe('Partial response')
  expect(streamer.is_loading).toBeFalsy()
})
```

This pattern is useful when:
- The server doesn't produce certain events you want to test the client handling
- You want to test client behavior in isolation
- You need precise control over the SSE event sequence


## Mocking Environment Variables

```ts
vi.mock('$env/static/private', () => ({
  XAI_API_KEY: 'test-key',
  GOOGLE_API_KEY: 'test-google-key',
}))

vi.mock('$env/static/public', () => ({
  PUBLIC_SUPABASE_API_URL: 'https://test.supabase.co',
  PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
}))

vi.mock('$app/environment', () => ({
  dev: true,
  browser: false,
}))
```

## Mocking Internal Modules

```ts
// Mock a service function
vi.mock('$lib/services/translate', () => ({
  translate_text: vi.fn(({ text }) => Promise.resolve(`translated: ${text}`)),
}))

// Mock with conditional behavior
vi.mock('$api/helper/some-helper', () => ({
  process_data: vi.fn((data) => {
    if (data.type === 'error') throw new Error('Processing failed')
    return { processed: true, ...data }
  }),
}))
```


## Test Patterns

### Use `describe` with Handler Reference

```ts
import { POST } from './+server'

describe(POST, () => {
  test('...', async () => { })
})
```

### Import Request Body Types

```ts
import { POST, type ChatRequestBody } from './+server'

test('validates input', async () => {
  const body: ChatRequestBody = {
    access_token: 'valid-token',
    messages: [{ role: 'user', content: 'hello' }],
  }
  const response = await request(POST, { body })
  // ...
})
```

### Testing URL Params

```ts
test('uses id from params', async () => {
  const response = await request(POST, { 
    params: { id: 'item-123' },
    body: { access_token: 'valid-token' }
  })
  expect(response.status).toBe(200)
})
```

### Testing Error Responses

```ts
test('returns 500 when external API fails', async () => {
  global.fetch = vi.fn(() => 
    Promise.resolve(new Response('Service unavailable', { status: 503 }))
  ) as typeof fetch

  await expect(() => request(POST, { body }))
    .rejects.toThrowErrorMatchingInlineSnapshot(`
      HttpError {
        "body": "xAI API error: 503",
        "status": 503,
      }
    `)
})
```


## Snapshot Testing Strategy

### Inline Snapshots for Small Results

Use `toMatchInlineSnapshot` for small, simple assertions that fit on a few lines:

```ts
test('returns error for missing token', async () => {
  await expect(() => request(POST, { body: { messages: [] } }))
    .rejects.toThrowErrorMatchingInlineSnapshot(`
      HttpError {
        "body": {
          "message": "access_token is required",
        },
        "status": 401,
      }
    `)
})

test('returns simple response', async () => {
  const response = await request(POST, { body })
  const data = await response.json()
  expect(data.text).toMatchInlineSnapshot(`"Hello world"`)
})
```

### File Snapshots for Larger Results

Use `toMatchFileSnapshot` when:
- Response is large (streaming results, complex JSON)
- Test file would become hard to read with inline content
- You want syntax highlighting (`.json` or `.json5` files get highlighting in editors)

```ts
test('returns full chat response', async () => {
  const response = await request(POST, { body })
  const data = await response.json()
  expect(data).toMatchFileSnapshot('./snapshots/chat-response.json')
})

test('streams back expected events', async () => {
  const response = await request(POST, { body: { ...body, stream: true } })
  const text = await response.text()
  expect(text).toMatchFileSnapshot('./snapshots/stream-events.txt')
})
```

Create snapshot files alongside your test:
```
src/routes/api/xai/chat/
├── +server.ts       # Endpoint handler
├── _call.ts         # Client functions
├── _call.test.ts    # Tests (for client)
└── snapshots/
    ├── chat-response.json
    └── stream-events.txt
```

Update snapshots with the `-u` flag:
```bash
pnpm vitest -u
```

## Tips

### Testing Strategy
- **Test `_call` files, not `+server.ts`** - Tests from client perspective, catches integration issues
- Route internal API calls through the real endpoint handler using the `request` helper
- Mock only external API calls (xAI, OpenAI, etc.)

### Authentication Testing
- Always test auth first: missing token, invalid token, valid token
- Mock localStorage to control the access token
- Test both the "throws" case (client-side auth check) and "returns error" case (server-side validation)

### Streaming Testing
- Test `is_loading` state during requests (not just after completion)
- Test error events during streams by mocking the endpoint directly
- Use `Promise` + checking state before `await` to verify loading states

### General
- Test validation errors with minimal bodies to ensure each check works
- Use `toThrowErrorMatchingInlineSnapshot` for error testing - shows full error structure
- Use inline snapshots for small results, file snapshots for large/complex results
- File snapshots get syntax highlighting and keep test files readable
- Mock fetch at test level for fine-grained control over responses
- Use `beforeEach`/`afterEach` to reset fetch mock and localStorage between tests
- Store `original_fetch` to restore after tests if needed for debugging

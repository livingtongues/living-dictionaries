# Streaming SSE Endpoints

Reference this when building or testing a streaming API endpoint. For non-streaming endpoints, see `SKILL.md`.

## _call.svelte.ts for Streaming

Streaming endpoints need manual `fetch` inside the `_call.svelte.ts` file. Use `get_url()` for the correct base URL and `get_auth_token()` for auth:

```ts
// routes/api/foo/bar/_call.svelte.ts
import type { FooBarRequestBody } from './+server'
import { get_auth_token } from '$lib/auth/get-token'
import { get_url } from '$lib/utils/requests'

export class FooBarStreamer {
  result = $state('')
  is_loading = $state(false)
  error = $state<string | null>(null)
  #abort_controller: AbortController | null = null

  async send(body: Omit<FooBarRequestBody, 'stream'>) {
    this.result = ''
    this.is_loading = true
    this.#abort_controller = new AbortController()

    const token = get_auth_token()
    const response = await fetch(get_url('/api/foo/bar'), {
      method: 'POST',
      signal: this.#abort_controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ ...body, stream: true }),
    })

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let accumulated = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      accumulated += decoder.decode(value, { stream: true })
      const lines = accumulated.split('\n\n')
      accumulated = lines.pop() || ''

      for (const chunk of lines) {
        const event_match = chunk.match(/^event: (?<event_type>\w+)\ndata: (?<json_data>.+)$/s)
        if (!event_match?.groups) continue

        const { event_type, json_data } = event_match.groups
        const data = JSON.parse(json_data)

        if (event_type === 'delta') this.result += data.text
        else if (event_type === 'done') { /* handle completion */ }
      }
    }
    this.is_loading = false
  }

  abort() { this.#abort_controller?.abort() }
}
```

The consuming component just calls the `_call` function — it never sees `fetch` or URLs.

## .svelte.ts Extension for Reactive State

When your `_call` file uses Svelte 5 runes (`$state`, `$derived`, etc.), use the `.svelte.ts` extension:

- `_call.ts` - Simple async functions without reactive state
- `_call.svelte.ts` - Classes or functions that use `$state` for reactive properties

When importing `.svelte.ts` files, use `.svelte.js` extension:
```ts
import { FooBarStreamer } from '$api/foo/bar/_call.svelte.js'
```

## Server-Side SSE Pattern

```ts
const encoder = new TextEncoder()
const output_stream = new ReadableStream({
  async start(controller) {
    function send_event(event: string, data: any) {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    }
    send_event('delta', { text: 'chunk of text' })
    send_event('done', { text: 'full text', citations: [] })
    controller.close()
  },
})

return new Response(output_stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
})
```

## Testing Streaming

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

// In your fetch mock:
if (url_string.includes('api.x.ai') && body?.stream) {
  const stream = create_mock_sse_stream([
    { event: 'delta', data: { text: 'Hello ' } },
    { event: 'delta', data: { text: 'world!' } },
    { event: 'done', data: { text: 'Hello world!', citations: [] } },
  ])
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}
```

### Mock at Different Levels

**Mock External API Stream** — for testing the endpoint's stream transformation:
```ts
test('streams response when stream=true', async () => {
  global.fetch = vi.fn(async (url: string | URL, options?: RequestInit) => {
    if (url.toString().includes('api.x.ai')) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Hello "}\n'))
          controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"world!"}\n'))
          controller.enqueue(encoder.encode('data: {"type":"response.done","response":{"output":[]}}\n'))
          controller.close()
        },
      })
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }
    throw new Error(`Unmocked: ${url}`)
  }) as typeof fetch
})
```

**Mock Server Stream Directly** — for testing client behavior (error events, partial responses) without going through the server. Useful when the server doesn't produce certain events you want to test:
```ts
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
})
```

### Tips

- Test `is_loading` state during streaming requests (not just after completion)

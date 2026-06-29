import type { RequestHandler } from './$types'

/**
 * GET /api/v1
 *
 * Tiny agent-and-human landing for the write API. Deliberately short — the
 * comprehensive surface is `/api/v1/openapi.json`, which an agent fetches and
 * self-configures from. A human who knows agents just pastes their key + this
 * URL to their agent.
 */
export const GET: RequestHandler = (event) => {
  const { origin } = event.url
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Living Dictionaries Write API (v1)</title>
  <style>
    :root { color-scheme: light dark }
    body { font: 15px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; max-width: 720px; margin: 2.5rem auto; padding: 0 1.25rem; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    pre { background: #f5f5f7; padding: 0.9rem 1rem; border-radius: 8px; overflow-x: auto; font-size: 13px; }
    @media (prefers-color-scheme: dark) { pre { background: #1c1c1e; } }
    h1 { font-size: 1.4rem; } h2 { font-size: 1.05rem; margin-top: 1.6rem; }
    a { color: #2563eb; } .muted { opacity: 0.7; }
    .pill { display:inline-block; font-size:12px; background:#2563eb; color:#fff; padding:1px 7px; border-radius:6px; }
  </style>
</head>
<body>
  <h1>Living Dictionaries Write API <span class="pill">v1</span></h1>
  <p>Programmatic, bulk-capable access to <strong>one dictionary</strong> — an agent can do anything a human editor can.</p>

  <h2>Point your agent here</h2>
  <p>Give your agent your API key (minted in the dictionary's Settings) and this spec URL — it will read the full reference itself:</p>
  <pre>${origin}/api/v1/openapi.json</pre>

  <h2>Auth</h2>
  <p>Every request: <code>Authorization: Bearer ldk_…</code>. The key is scoped to one dictionary; writes need <code>editor</code>+.</p>

  <h2>Quickstart</h2>
  <pre>curl -s ${origin}/api/v1/dictionaries/&lt;DICTIONARY_ID&gt; \\
  -H "Authorization: Bearer ldk_…"   # learn its gloss_languages first

curl -s -X POST ${origin}/api/v1/dictionaries/&lt;DICTIONARY_ID&gt;/entries \\
  -H "Authorization: Bearer ldk_…" -H "content-type: application/json" \\
  -d '{"entries":[{"lexeme":"mbwa","senses":[{"glosses":{"en":"dog"},
       "example_sentences":[{"text":"Mbwa wangu","translation":{"en":"My dog"}}]}]}]}'</pre>

  <p class="muted">Full schemas, every endpoint, and field docs: <a href="${origin}/api/v1/openapi.json">/api/v1/openapi.json</a></p>
</body>
</html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

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
  <p>Give your agent your API key (minted on the dictionary's Agents page) and this spec URL — it will read the full reference itself:</p>
  <pre>${origin}/api/v1/openapi.json</pre>

  <h2>Auth</h2>
  <p>Every request: <code>Authorization: Bearer ldk_…</code>. The key is scoped to one dictionary and is either <strong>read</strong> or <strong>read &amp; write</strong> — writes need a read &amp; write key. The <code>&lt;DICTIONARY_ID&gt;</code> in the paths is the id of that dictionary (the <code>&lt;id&gt;</code> in its web URL) — whoever gave you the key tells you which.</p>

  <h2>Import workflow</h2>
  <ol>
    <li><code>GET /api/v1/dictionaries/&lt;id&gt;</code> → read <code>gloss_languages</code> (which locale codes to key glosses by). <span class="muted">Don't trust <code>entry_count</code> to verify an import — it's eventually-consistent and lags; paginate <code>/entries</code> for a live count.</span></li>
    <li>Generate a UUID (v4) yourself for each entry and send it as <code>id</code> — that's your idempotency key: you know it up front (record it against your source id), you use it for later <code>PATCH …/entries/&lt;id&gt;</code> edits, and re-POSTing the same <code>id</code> is a safe no-op (<code>status: "exists"</code>).</li>
    <li><code>POST …/entries</code> with <code>{ entries: [...], import_id }</code> in batches of ≤1000 (and ≤~16MB/request); read the per-item <code>results</code> and re-send only <code>failed</code>.</li>
    <li>Spot-check with <code>GET …/entries/&lt;entryId&gt;</code>, or bulk-read with <code>GET …/entries?include=senses</code>. <span class="muted">Read shape ≠ write shape: top-level scalars come back under <code>entry.main</code>, and <code>example_sentences</code> come back as <code>sentences</code>.</span></li>
  </ol>
  <p>Multilingual fields take a plain string or a <code>{ locale: text }</code> map; use <code>default</code> for the vernacular and gloss-language codes for glosses/translations. Full Unicode/IPA is stored verbatim.</p>
  <p class="muted">v1 covers entries/senses/example-sentences/<strong>texts</strong>/speakers/tags/dialects/sources — not media. Any standard HTTP client works; a descriptive <code>User-Agent</code> is good practice.</p>
  <p class="muted">Stuck or need something we don't offer? <code>POST …/feedback</code> with <code>{ message }</code> — it reaches the LD team directly (read or write keys); then relay the response's note to your human.</p>

  <h2>Editing &amp; cleanup</h2>
  <p>Field-merge a whole entry with <code>PATCH …/entries/&lt;entryId&gt;</code>, or fix ONE row by its id (read ids from <code>GET …/entries/&lt;entryId&gt;</code>):</p>
  <ul>
    <li><code>PATCH</code>/<code>DELETE …/sentences/&lt;id&gt;</code> — edit or remove a single example sentence (the OCR-typo fix).</li>
    <li><code>DELETE …/senses/&lt;id&gt;</code> — remove one sense (not the entry's last).</li>
    <li><code>PATCH</code>/<code>DELETE …/tags/&lt;id&gt;</code> &amp; <code>…/dialects/&lt;id&gt;</code> — rename (affects every entry) or delete globally.</li>
    <li><code>DELETE …/entries/&lt;entryId&gt;/tags/&lt;id&gt;</code> (or <code>/dialects/&lt;id&gt;</code>) — unlink one from a single entry, keeping it elsewhere.</li>
  </ul>

  <h2>Importing from a PDF / scanned dictionary</h2>
  <p class="muted">Tool-agnostic outline — pick current tools, they change fast.</p>
  <ol>
    <li><strong>Pages → images</strong> at ~300 dpi (e.g. PyMuPDF / pdftoppm).</li>
    <li><strong>OCR with a layout-aware vision-language model</strong> — a document-parsing VLM handles multi-column dictionaries well; pick a current one. Where glyphs/diacritics look wrong, fall back to inspecting the image directly.</li>
    <li><strong>Structure</strong> the text into the entry shape: identify headwords (often numbered homographs; in many orthographies short/monosyllabic), separate the vernacular phrase from the gloss, and attach usages as <code>example_sentences</code>.</li>
    <li><strong>Respect orthography</strong> — validate tokens against the language's spelling rules; never transliterate or "clean up" diacritics. Flag low-confidence OCR as a private tag (e.g. <code>needs-review</code>) instead of inventing data.</li>
    <li><strong>Import idempotently</strong>: generate a UUID <code>id</code> per source entry and record it against your source id (dedupe/resume by it — re-POSTing an existing <code>id</code> is a no-op); <code>import_id</code> tags the run; batches ≤1000; read per-item <code>results</code>, re-send only failures. Spot-check with <code>GET …/entries/&lt;entryId&gt;</code>. <span class="muted"><code>elicitation_id</code> is for word-list/elicitation ordering — persisted &amp; queryable via <code>?elicitation_id=</code>, so use it for dedupe only if your source id is genuinely elicitation data.</span></li>
  </ol>

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

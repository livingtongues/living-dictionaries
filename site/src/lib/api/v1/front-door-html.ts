import type { FrontDoorDoc } from './front-door'

/**
 * The human rendering of the SAME front-door object agents get as JSON — so a
 * person pasting `/api/v1` into a browser walks the identical journey (pick your
 * job → read its guide → then the reference) instead of a parallel hand-written
 * page that drifts. Deliberately dependency-free inline CSS: this is served
 * outside the app shell.
 */

function escape_html(text: string): string {
  return text.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] as string))
}

/** Renders `backticked` spans as <code> after escaping. */
function inline(text: string): string {
  return escape_html(text).replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function render_front_door_html(doc: FrontDoorDoc): string {
  const dictionary_block = doc.dictionary
    ? `<div class="ctx">
      <div class="ctx-title">Your key: <strong>${escape_html(doc.dictionary.name)}</strong> <span class="pill">${doc.dictionary.scope === 'write' ? 'read &amp; write' : 'read only'}</span></div>
      <div class="ctx-meta">${doc.dictionary.entry_count.toLocaleString()} entries${doc.dictionary.gloss_languages?.length ? ` · gloss languages: ${doc.dictionary.gloss_languages.map(escape_html).join(', ')}` : ''}</div>
      ${doc.suggested_task ? `<div class="ctx-suggest">Suggested starting point: <a href="#task-${doc.suggested_task.task}"><strong>${escape_html(doc.suggested_task.task)}</strong></a> — ${escape_html(doc.suggested_task.because)}</div>` : ''}
    </div>`
    : ''

  const tasks = doc.tasks.map(task => `
    <section class="task" id="task-${task.id}">
      <h3 class="task-title"><span class="task-id">${escape_html(task.id)}</span> ${escape_html(task.title)}</h3>
      <p class="task-when">${inline(task.when)}</p>
      ${task.guides.length
        ? `<p class="task-guides">Read first: ${task.guides.map((guide, index) => `<a href="${guide.url}"${index === 0 ? ' class="primary"' : ''}>${escape_html(guide.slug)}</a>`).join(' · ')}</p>`
        : ''}
      <ul class="calls">
        ${task.next.map(call => `<li><code class="m m-${call.method.toLowerCase()}">${call.method}</code> <a href="${call.url}">${escape_html(call.url.replace(/^https?:\/\/[^/]+/, ''))}</a><span class="why">${inline(call.why)}</span></li>`).join('')}
      </ul>
    </section>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escape_html(doc.name)}</title>
  <style>
    :root { color-scheme: light dark; --line: rgba(127,127,127,0.25); --dim: color-mix(in srgb, currentColor 62%, transparent); }
    body { font: 15px/1.6 -apple-system, Segoe UI, Roboto, sans-serif; max-width: 820px; margin: 2.5rem auto; padding: 0 1.25rem; }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    pre { background: color-mix(in srgb, currentColor 6%, transparent); padding: 0.9rem 1rem; border-radius: 8px; overflow-x: auto; font-size: 13px; }
    h1 { font-size: 1.45rem; margin-bottom: 0.35rem; }
    h2 { font-size: 1.05rem; margin: 2rem 0 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--line); }
    a { color: #2563eb; }
    .pill { display: inline-block; font-size: 12px; background: #2563eb; color: #fff; padding: 1px 7px; border-radius: 6px; vertical-align: middle; }
    .lede { font-size: 0.95rem; }
    .start { background: color-mix(in srgb, #2563eb 8%, transparent); border: 1px solid var(--line); border-radius: 10px; padding: 0.8rem 1rem; margin: 1rem 0; font-size: 0.9rem; }
    .ctx { background: color-mix(in srgb, #16a34a 10%, transparent); border: 1px solid var(--line); border-radius: 10px; padding: 0.8rem 1rem; margin: 1rem 0; font-size: 0.9rem; }
    .ctx-meta, .ctx-suggest { color: var(--dim); font-size: 0.85rem; margin-top: 0.25rem; }
    .task { border: 1px solid var(--line); border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 0.75rem; scroll-margin-top: 1rem; }
    .task-title { font-size: 1rem; margin: 0 0 0.35rem; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
    .task-id { font-family: ui-monospace, monospace; font-size: 0.75rem; color: #2563eb; border: 1px solid currentColor; border-radius: 5px; padding: 0 0.35rem; }
    .task-when { font-size: 0.87rem; margin: 0 0 0.5rem; }
    .task-guides { font-size: 0.85rem; margin: 0 0 0.5rem; }
    .task-guides .primary { font-weight: 700; }
    .calls { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .calls li { font-size: 0.82rem; }
    .m { font-size: 0.7rem; font-weight: 700; border: 1px solid currentColor; border-radius: 4px; padding: 0 0.3rem; }
    .m-get { color: #2563eb; } .m-post { color: #16a34a; } .m-patch { color: #d97706; } .m-delete { color: #dc2626; }
    .why { display: block; color: var(--dim); font-size: 0.8rem; }
    table { border-collapse: collapse; font-size: 0.85rem; width: 100%; }
    td { padding: 0.3rem 0.6rem 0.3rem 0; vertical-align: top; border-bottom: 1px solid var(--line); }
    td:first-child { white-space: nowrap; }
    .muted { color: var(--dim); font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>${escape_html(doc.name)}</h1>
  <p class="lede">${escape_html(doc.what)}</p>

  <div class="start">${inline(doc.start)}</div>
  ${dictionary_block}

  <h2>Auth</h2>
  <pre>${escape_html(doc.auth.header)}</pre>
  <p class="muted">${inline(doc.auth.key)} ${inline(doc.auth.scopes)}</p>

  <h2>Pick your job</h2>
  ${tasks}

  <h2>Guides</h2>
  <p class="muted">Every playbook, listed with its blurb: <a href="${doc.guides_index}">${escape_html(doc.guides_index)}</a> — each one is plain markdown at <code>/api/v1/guides/{slug}</code>.</p>

  <h2>Endpoint reference</h2>
  <p class="muted">${inline(doc.reference.note)}</p>
  <table>
    <tr><td>Compact index</td><td><a href="${doc.reference.index}">${escape_html(doc.reference.index)}</a></td></tr>
    <tr><td>One group</td><td><a href="${doc.reference.by_group}">${escape_html(doc.reference.by_group)}</a></td></tr>
    <tr><td>Everything</td><td><a href="${doc.reference.full}">${escape_html(doc.reference.full)}</a></td></tr>
  </table>
  <p class="muted">Groups: ${doc.reference.groups.map(group => `<code>${escape_html(group)}</code>`).join(' ')}</p>

  <p class="muted">This page is the human rendering of the JSON an agent receives here. Fetch it with <code>Accept: application/json</code> (or add <code>?format=json</code>) to see exactly what your agent sees.</p>
</body>
</html>`
}

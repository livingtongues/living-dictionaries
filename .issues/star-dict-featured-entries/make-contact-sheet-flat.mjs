import fs from 'node:fs/promises'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

// Usage: node make-contact-sheet-flat.mjs <input-json> <batch-name> <chunk-size>
// input-json: flat array of { dict_id, dict_name, lexeme, gloss, photo_serving_url, ... }
const [input_path, batch_name, chunk_size_arg] = process.argv.slice(2)
const chunk_size = Number(chunk_size_arg) || 40
if (!input_path || !batch_name) {
  console.error('Usage: node make-contact-sheet-flat.mjs <input-json> <batch-name> <chunk-size>')
  process.exit(1)
}

const rows = JSON.parse(await fs.readFile(new URL(input_path, import.meta.url), 'utf8'))

function img_src(row) {
  if (!row.photo_serving_url) return ''
  return `https://lh3.googleusercontent.com/${row.photo_serving_url}=w220`
}

function escape_html(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[m]))
}

const chunks = []
for (let i = 0; i < rows.length; i += chunk_size) chunks.push(rows.slice(i, i + chunk_size))

for (let ci = 0; ci < chunks.length; ci++) {
  const chunk = chunks[ci]
  let html = `<!doctype html><html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, Arial, sans-serif; background: #111; color: #eee; margin: 0; padding: 16px; }
.grid { display: flex; flex-wrap: wrap; gap: 10px; }
.card { width: 150px; background: #1c1c1c; border-radius: 8px; overflow: hidden; border: 2px solid #333; }
.card img { width: 150px; height: 150px; object-fit: cover; display: block; background: #333; }
.card .noimg { width: 150px; height: 150px; display:flex; align-items:center; justify-content:center; color:#666; font-size:11px; }
.card .label { padding: 5px 6px; font-size: 11px; line-height: 1.3; }
.card .idx { font-weight: 700; color: #6366f1; }
.card .dict { color: #6cf; }
.card .lex { font-weight: 600; }
.card .gloss { color: #aaa; }
</style></head><body>\n`
  html += `<div class="grid">`
  chunk.forEach((r, i) => {
    const src = img_src(r)
    const global_idx = ci * chunk_size + i
    html += `<div class="card">`
    html += src ? `<img src="${src}" loading="eager">` : `<div class="noimg">no photo</div>`
    html += `<div class="label"><span class="idx">${global_idx}</span> <span class="dict">${escape_html(r.dict_name)}</span><br><span class="lex">${escape_html(r.lexeme)}</span><br><span class="gloss">${escape_html(r.gloss ?? '')} (${escape_html(r.gloss_language)})</span></div>`
    html += `</div>`
  })
  html += `</div></body></html>`

  const html_path = new URL(`./contact-sheets/${batch_name}-${ci}.html`, import.meta.url)
  await fs.writeFile(html_path, html)

  const browser = await launch()
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 1000 })
  await page.goto(`file://${html_path.pathname}`, { waitUntil: 'networkidle0', timeout: 60000 })
  await new Promise(r => setTimeout(r, 1500))
  const png_path = new URL(`./contact-sheets/${batch_name}-${ci}.png`, import.meta.url)
  await page.screenshot({ path: png_path.pathname, fullPage: true })
  await browser.close()
  console.error(`Wrote ${html_path.pathname} and ${png_path.pathname}`)
}

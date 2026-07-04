import fs from 'node:fs/promises'
import { launch } from '/home/jacob/.claude/skills/browser-tools/browser-launch.mjs'

// Usage: node make-contact-sheet-range.mjs <batch-name> <dict-id>:<start>-<end> [dict-id:start-end ...]
const [batch_name, ...specs] = process.argv.slice(2)
if (!batch_name || specs.length === 0) {
  console.error('Usage: node make-contact-sheet-range.mjs <batch-name> <dict-id>:<start>-<end> [...]')
  process.exit(1)
}

const harvest = JSON.parse(await fs.readFile(new URL('./harvest.json', import.meta.url), 'utf8'))
const by_id = new Map(harvest.map(d => [d.id, d]))

function img_src(candidate) {
  if (!candidate.photo_url) return ''
  return `https://lh3.googleusercontent.com/${candidate.photo_url}=w220`
}
function escape_html(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[m]))
}

let html = `<!doctype html><html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, Arial, sans-serif; background: #111; color: #eee; margin: 0; padding: 16px; }
.dict { border-top: 4px solid #6366f1; margin-bottom: 28px; padding-top: 10px; }
.dict h2 { margin: 0 0 2px; font-size: 18px; }
.dict .meta { color: #999; font-size: 12px; margin-bottom: 10px; }
.grid { display: flex; flex-wrap: wrap; gap: 10px; }
.card { width: 150px; background: #1c1c1c; border-radius: 8px; overflow: hidden; border: 2px solid #333; }
.card img { width: 150px; height: 150px; object-fit: cover; display: block; background: #333; }
.card .noimg { width: 150px; height: 150px; display:flex; align-items:center; justify-content:center; color:#666; font-size:11px; }
.card .label { padding: 5px 6px; font-size: 11px; line-height: 1.3; }
.card .idx { font-weight: 700; color: #6366f1; }
.card .lex { font-weight: 600; }
.card .gloss { color: #aaa; }
</style></head><body>\n`

for (const spec of specs) {
  const [dict_id, range] = spec.split(':')
  const [start, end] = range.split('-').map(Number)
  const dict = by_id.get(dict_id)
  if (!dict) { console.error(`WARN: dict ${dict_id} not found`); continue }
  const candidates = dict.candidates.slice(start, end + 1)
  html += `<div class="dict"><h2>${dict.name} <span style="color:#666;font-weight:400">(${dict.id})</span></h2>`
  html += `<div class="meta">tier=${dict.tier} · entry_count=${dict.entry_count} · showing indices ${start}-${end} of ${dict.candidates.length}</div>`
  html += `<div class="grid">`
  candidates.forEach((c, i) => {
    const real_idx = start + i
    const src = img_src(c)
    html += `<div class="card">`
    html += src ? `<img src="${src}" loading="eager">` : `<div class="noimg">no photo</div>`
    html += `<div class="label"><span class="idx">${real_idx}</span> <span class="lex">${escape_html(c.lexeme)}</span><br><span class="gloss">${escape_html(c.gloss ?? '')}</span></div>`
    html += `</div>`
  })
  html += `</div></div>\n`
}
html += `</body></html>`

const html_path = new URL(`./contact-sheets/${batch_name}.html`, import.meta.url)
await fs.writeFile(html_path, html)

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 1000 })
await page.goto(`file://${html_path.pathname}`, { waitUntil: 'networkidle0', timeout: 60000 })
await new Promise(r => setTimeout(r, 1500))
const png_path = new URL(`./contact-sheets/${batch_name}.png`, import.meta.url)
await page.screenshot({ path: png_path.pathname, fullPage: true })
await browser.close()
console.error(`Wrote ${html_path.pathname} and ${png_path.pathname}`)

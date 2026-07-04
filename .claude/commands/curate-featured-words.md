---
description: Harvest + vision-check homepage word-card candidates from prod, insert as 'suggested' for review at /admin/featured-words
---

# Curate featured words (homepage showcase)

Populate `shared.db.featured_entries` with fresh candidate word cards — public-dictionary entries
that have **entry audio + a sense photo**. Jacob approves/rejects at **/admin/featured-words**;
approved cards ship on the next deploy (build-time bake via `/api/homepage/export` →
`fetch-homepage-baked.mjs`). Target pool: 100–200 approved cards. First seed batch (26 cards,
2026-07-04) lives in `site/src/lib/data/homepage-baked.json` + prod rows.

## Selection principles (from Jacob)

- **Public dictionaries only.**
- **Global geographic spread** — hit every region with candidates (Americas, Africa, Asia,
  Pacific, Europe). ~72 public dicts have candidates; ~9,250 candidate entries total.
- **Prefer larger dictionaries** (more interesting to click into) but sprinkle small ones.
- **~half English glosses, half other languages** (es/hi/fr/pt/sw/cmn/tpi/el/… — show variety).
- Only lively, appealing photos + clean audio. When in doubt, leave it out.

## Step 1 — harvest candidates on the VPS

```bash
cat > /tmp/harvest.js <<'EOF'
const fs = require('fs')
const Database = require('better-sqlite3')
const shared = new Database('/data/shared.db', { readonly: true })
const dicts = shared.prepare("SELECT id, name, coordinates, entry_count FROM dictionaries WHERE public = 1").all()
const existing = new Set(shared.prepare('SELECT dict_id || ":" || entry_id AS key FROM featured_entries').all().map(row => row.key))
const out = []
for (const d of dicts) {
  const path = `/data/dictionaries/${d.id}.db`
  if (!fs.existsSync(path)) continue
  try {
    const db = new Database(path, { readonly: true })
    const rows = db.prepare(`
      SELECT e.id AS entry_id, e.lexeme, s.id AS sense_id, s.glosses,
        p.id AS photo_id, p.serving_url, a.id AS audio_id, a.storage_path
      FROM entries e
      JOIN audio a ON a.entry_id = e.id
      JOIN senses s ON s.entry_id = e.id
      JOIN sense_photos sp ON sp.sense_id = s.id
      JOIN photos p ON p.id = sp.photo_id
      GROUP BY e.id ORDER BY RANDOM() LIMIT 8`).all()
      .filter(row => !existing.has(`${d.id}:${row.entry_id}`))
    db.close()
    if (!rows.length) continue
    let coords = null
    try { coords = JSON.parse(d.coordinates)?.points?.[0]?.coordinates ?? null } catch {}
    out.push({ dict_id: d.id, dict_name: d.name, entry_count: d.entry_count, lat: coords?.latitude ?? null, lng: coords?.longitude ?? null, samples: rows })
  } catch {}
}
console.log(JSON.stringify(out))
EOF
ssh living 'docker exec -i sveltekit_blue node' < /tmp/harvest.js > /tmp/harvest.json
```

## Step 2 — select a balanced batch locally

Filter + pick with a node script (see the seed run in `.issues/homepage-v2.md` history):
- `lexeme` = `JSON.parse(sample.lexeme).default ?? first value`; skip empty or > 30 chars.
- Gloss: prefer the target language for the dict's region; skip glosses that are empty, > 45
  chars, or junk (`ID to be determined`, `??`, `unknown`). **Clean up keepers**: strip HTML tags
  (`<i>…</i>`), drop trailing Latin binomials ("(Ducula badia)"), trim whitespace.
- 1–2 cards per dictionary per batch.

## Step 3 — vision-check every image (mandatory)

Build a contact sheet of `https://lh3.googleusercontent.com/<serving_url>=s150-p` thumbs +
labels, screenshot it headless (see browser-tools skill), and **look at it**. Reject:
- clipart / stock-graphic look (stars, numbers, drawings), watermarked stock (gettyimages etc.)
- literal color squares (all-gray "gray", all-black "black"), broken/blank images
- image-word mismatches, boring/unclear photos
- lexemes in scripts most devices lack fonts for (e.g. Wancho 𞋃𞋜 → tofu boxes)

Optionally spot-check audio: `https://firebasestorage.googleapis.com/v0/b/talking-dictionaries-alpha.appspot.com/o/<url-encoded storage_path>?alt=media`
(Jacob listens to everything during review anyway — that's the point of the admin page.)

## Step 4 — insert as 'suggested' on prod

```bash
cat > /tmp/insert-featured.js <<'EOF'
const Database = require('better-sqlite3')
const db = new Database('/data/shared.db')
const cards = JSON.parse(require('fs').readFileSync(0, 'utf8'))  // pipe the picked JSON in
const insert = db.prepare(`INSERT OR IGNORE INTO featured_entries
  (id, dict_id, entry_id, sense_id, photo_id, audio_id, lexeme, gloss, gloss_language,
   photo_serving_url, audio_storage_path, dict_name, longitude, latitude, status, agent_note)
  VALUES (@id, @dict_id, @entry_id, @sense_id, @photo_id, @audio_id, @lexeme, @gloss, @gloss_language,
   @photo_serving_url, @audio_storage_path, @dict_name, @lng, @lat, 'suggested', @agent_note)`)
let n = 0
for (const card of cards) n += insert.run({ id: crypto.randomUUID(), ...card }).changes
console.log('inserted', n)
EOF
# combine files then: ssh living 'docker exec -i sveltekit_blue node /dev/stdin' — or write a temp file server-side
```

Set `agent_note` to a one-line reason ("balanced batch #2 — Pacific focus, checked 2026-07-XX").
NEVER insert as `approved` — Jacob reviews. `UNIQUE (dict_id, entry_id)` makes re-runs safe.

## Step 5 — hand off

Tell Jacob how many suggestions landed and remind him: review at **/admin/featured-words**
(listen to audio there), then the next deploy bakes approved cards onto the homepage.

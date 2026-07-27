# Audio, photos, and video

Attaching recordings and images, attributing them properly, and generating karaoke
word-timings. Read `api-basics` first if you haven't.

## One call uploads and links

There is no separate "upload then attach" step. `POST` to the owner's media route
with **either** the bytes as multipart `file` **or** JSON `{ "url": "https://…" }`
(we fetch it). You get back the created media object with its `id` and `created`.

| Media | Attaches to | Route |
|---|---|---|
| audio | entry (headword pronunciation) | `POST …/entries/{entryId}/audio` |
| audio | sentence | `POST …/sentences/{sentenceId}/audio` |
| audio | text | `POST …/texts/{textId}/audio` |
| photos | sense | `POST …/senses/{senseId}/photos` |
| photos | sentence | `POST …/sentences/{sentenceId}/photos` |
| videos | sense, sentence, or text | `POST …/senses/{senseId}/videos`, etc. |

Typical import flow: create the entry (the response gives you its `id` and
`sense_ids`), then `POST …/entries/{entryId}/audio` with the pronunciation and
`POST …/senses/{senseId}/photos` with the illustrative photo.

Remove with `DELETE …/{audioId|photoId|videoId}`.

## Attribution is required for audio and video

Every audio or video row needs **`speaker_id`, or `source`, or both**:

- **`speaker_id`** — an existing speaker (`POST …/speakers` to create). Use this
  when you know who is speaking.
- **`source`** — a slug from the dictionary's source registry (`POST …/sources`
  first; the create-first rule is strict, an unknown slug rejects the write). Use
  this when the recording comes from a website, archive, or publication.

**Never invent a placeholder speaker to satisfy the requirement.** Speakers are real
people — their name, birth decade, gender, and birthplace appear on the dictionary's
contributors page. A recording of unknown provenance gets a *source*, not a fictional
person. If your material genuinely has neither, ask your human before proceeding.

Photos are different: their optional `source` / `photographer` are **free text**
shown as the on-image caption, not registry slugs.

## Idempotency and replacement

- Send your own UUID as `id` so a re-POST is a safe no-op (same habit as entries).
- Send `replace: true` to first remove existing media of that type on that owner —
  the right move for "exactly one pronunciation per headword".

## Size caps

| Audio | Photo | Video |
|---|---|---|
| 25 MB | 10 MB | 100 MB |

For anything bigger than the video cap, link a hosted video instead: pass
`hosted_url` with a YouTube or Vimeo watch URL. That's preferred for large video
generally — it stays streamable and costs the community nothing in storage.

## Karaoke word-timings

Sentence and text audio can carry per-word timings that highlight each word as it's
spoken. The shape is the `MediaTimings` schema: a sentence id → a compact timing
string aligned **1:1 with that sentence's stored tokens**. The token list is the
shared index that the gloss line, word→entry links, and playback highlighting all
align to — so timings only make sense for a tokenized sentence (see the `corpus`
guide).

Two ways to set them:

- On the audio POST, as `timings`.
- Later: `PATCH …/sentences/{sentenceId}/audio/{audioId}` or
  `PATCH …/texts/{textId}/audio/{audioId}`.

**Don't hand-guess timings.** They come from forced alignment. If the dictionary is
configured for it, ask us to align server-side:

```
POST …/sentences/{sentenceId}/audio/{audioId}/align
POST …/texts/{textId}/audio/{audioId}/align
→ poll GET …/align-jobs/{jobId}
```

Alignment needs a per-dictionary romanization config the Living Dictionaries team
sets up. If the endpoint tells you it isn't configured, `POST …/feedback` and ask —
don't fabricate timings.

## Reading media back

`GET …/texts/{textId}` is the efficient one: it returns the text's audio at BOTH
text and sentence level, with `timings`, speakers, and a `download_url` per row —
one call for text + sentences + audio + speakers.

For any stored media, `GET …/media/{storage_path}` 302-redirects to the bytes.

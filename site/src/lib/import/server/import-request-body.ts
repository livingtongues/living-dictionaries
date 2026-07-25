export interface ImportRequestBodyFile {
  id: string
  filename: string
  size_bytes: number
  mimetype: string
  import_instructions: string | null
  source_note: string | null
}

export interface ImportRequestBodyOptions {
  origin: string
  dictionary: { id: string, name: string, url: string }
  requester: { id: string, email: string, name: string | null }
  files: ImportRequestBodyFile[]
  note?: string | null
  /** The import conversation this request opened — where the whole job is worked. */
  thread_id?: string
}

function format_mb(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * The kickoff brief — the first message of an import-request thread, written to
 * be pasted straight into an agent session. Kept out of the endpoint so the same
 * text can be regenerated for older threads when the workflow changes.
 */
export function build_import_request_body({ origin, dictionary, requester, files, note, thread_id = '{threadId}' }: ImportRequestBodyOptions): string {
  const file_sections = files.map((file, index) => [
    `${index + 1}. ${file.filename} (${format_mb(file.size_bytes)}, ${file.mimetype})`,
    `   Download: ${origin}/api/v1/dictionaries/${dictionary.id}/files/${file.id}`,
    `   Instructions: ${file.import_instructions?.trim()}`,
    ...(file.source_note?.trim() ? [`   Source: ${file.source_note.trim()}`] : ['   Source: (none given — write a best-effort citation during import)']),
  ].join('\n'))

  return [
    `Import request for ${dictionary.name} (${origin}/${dictionary.url})`,
    '',
    `Requested by: ${requester.name || requester.email} <${requester.email}> (user id: ${requester.id})`,
    `Dictionary id: ${dictionary.id}`,
    ...(note?.trim() ? ['', `Note from the requester: ${note.trim()}`] : []),
    '',
    `Resources (${files.length}):`,
    '',
    file_sections.join('\n\n'),
    '',
    '--- For the importing agent ---',
    '',
    `Auth: EVERY request below (including the downloads above) needs an \`Authorization: Bearer <write-scope API key>\` header. API base: ${origin}/api/v1 · dictionary id: ${dictionary.id}`,
    '',
    'Run the job in this order:',
    `1. Read ${origin}/api/v1/guides/importing FIRST — it is the mandatory workflow and it is not optional. Then the format guide matching each file (${origin}/api/v1/guides), and the API reference as ${origin}/api/v1/openapi.json?view=index followed by ?tag=<group>.`,
    `2. Claim the job: PATCH …/conversations/${thread_id} with {"started": true}. That tells the manager work has begun and freezes these resources as permanent record. Everything else about this import — your report, your questions, and any back-and-forth with the manager — happens on that conversation at ${origin}/${dictionary.url}/import/${thread_id}.`,
    '3. Download every resource above and inspect it — never trust the file extension.',
    '4. Register the source and file these resources under it, before any data work: POST …/sources with a simple stable slug, then PATCH …/files/{fileId} with {"source_id": "<source id>"} for EVERY file in this request, so every record you write can carry the slug + a locator from the first write.',
    '5. Phase 1 — data preparation, with NO data writes yet: profile the material, ask the requester the linguistic questions inspection raises (post them on the conversation), stage locally, read the data in bulk, clean with auditable rules, then get human sign-off on a rendered preview.',
    '6. Phase 2 — write in idempotent batches under one import_id, verify counts and spot-check content against the source, and set the editor-only `review` field on anything a human still has to decide.',
    '7. Finish (guide §2.7): POST the report HTML to …/conversations/{threadId}/artifacts, POST the whole-import questions to …/conversations/{threadId}/questions, and POST a short warm message to …/conversations/{threadId}/messages — that message is what emails the manager. Then tell the Living Dictionaries team; a human resolves the conversation.',
    '',
    'Living Dictionaries team agents: also read `.knowledge/domain/import-workflow.md` in the repo for the insider-only steps (production access, backups, handing the job back).',
  ].join('\n')
}

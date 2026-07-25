<script lang="ts">
  import type { ImportFileForClient } from '$lib/import/types'
  import { format_bytes } from '$lib/utils/format-bytes'
  import { format_date } from '$lib/utils/format-relative-time'
  import IconMdiDownload from '~icons/mdi/download'

  interface Props {
    dictionary_id: string
    files: ImportFileForClient[]
    label?: string
  }

  const { dictionary_id, files, label = files.length === 1 ? 'Source file' : 'Source files' }: Props = $props()
</script>

<div class="source-files">
  <div class="label">{label}</div>
  <ul>
    {#each files as file (file.id)}
      <li>
        <a href={`/api/v1/dictionaries/${dictionary_id}/files/${file.id}`} download={file.filename}>
          <IconMdiDownload />
          <span class="filename">{file.filename}</span>
          <span class="metadata">{format_bytes(file.size_bytes)} · {format_date(file.created_at)}</span>
        </a>
        {#if file.source_note?.trim()}
          <div class="note">{file.source_note.trim()}</div>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .source-files {
    border-left: 3px solid color-mix(in srgb, var(--primary) 55%, transparent);
    padding: 0.25rem 0 0.25rem 0.75rem;
  }
  .label {
    color: var(--color-secondary);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    min-width: 0;
  }
  a {
    align-items: center;
    color: var(--primary);
    display: flex;
    gap: 0.4rem;
    min-width: 0;
    text-decoration: none;
  }
  a:hover .filename {
    text-decoration: underline;
  }
  a :global(svg) {
    flex: 0 0 auto;
  }
  .filename {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .metadata {
    color: var(--color-secondary);
    font-size: 0.75rem;
    white-space: nowrap;
  }
  .note {
    color: var(--color-secondary);
    font-size: 0.78rem;
    line-height: 1.4;
    margin: 0.15rem 0 0 1.4rem;
  }
  @media (max-width: 520px) {
    a {
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .metadata {
      flex-basis: 100%;
      margin-left: 1.4rem;
    }
  }
</style>

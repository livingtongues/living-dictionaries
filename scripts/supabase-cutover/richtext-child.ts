import process from 'node:process'
import readline from 'node:readline'
import { convert_multistring, convert_value, create_conversion_stats } from './richtext'
import { to_ndjson_line } from './richtext-pool'

/**
 * Conversion child process (see richtext-pool.ts). Tiptap/ProseMirror retain
 * heap per `html_to_markdown` call no matter what, so the parent runs
 * conversions in THIS disposable process and recycles it when its budget is
 * spent. Protocol: newline-delimited JSON on stdin/stdout.
 *
 *   in : { id, kind: 'value' | 'multistring', value, where }
 *   out: { id, result, stats: { converted, passed_through, emptied }, mismatches: [...] }
 */

const rl = readline.createInterface({ input: process.stdin, terminal: false })

rl.on('line', (line) => {
  if (!line.trim())
    return
  const request = JSON.parse(line) as { id: number, kind: 'value' | 'multistring', value: unknown, where: string }
  const stats = create_conversion_stats()
  let result: unknown = null
  let error: string | undefined
  try {
    result = request.kind === 'multistring'
      ? convert_multistring({ value: request.value, where: request.where, stats })
      : convert_value({ value: request.value, where: request.where, stats })
  } catch (thrown) {
    error = (thrown as Error).message
  }
  process.stdout.write(to_ndjson_line({
    id: request.id,
    result,
    error,
    stats: { converted: stats.converted, passed_through: stats.passed_through, emptied: stats.emptied },
    mismatches: stats.mismatches,
  }))
})

rl.on('close', () => process.exit(0))

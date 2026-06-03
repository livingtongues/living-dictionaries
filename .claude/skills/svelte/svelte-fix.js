#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { create_mcp_client } from './mcp-client.js'

const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('Usage: svelte-fix.js <file.svelte> [--version <5|4>]')
  console.log('')
  console.log('Analyzes a Svelte component and returns suggestions.')
  console.log('Reads from a file path or stdin (pipe).')
  console.log('')
  console.log('Examples:')
  console.log('  svelte-fix.js src/lib/Button.svelte')
  console.log('  svelte-fix.js src/lib/Button.svelte --version 5')
  console.log('  echo \'<script>let x = 1</script>\' | svelte-fix.js -')
  process.exit(0)
}

let version = 5
let file_path = null

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--version' && args[i + 1]) {
    version = Number.parseInt(args[++i], 10)
  } else if (!file_path) {
    file_path = args[i]
  }
}

let code
let filename

if (file_path === '-') {
  code = readFileSync(0, 'utf-8')
  filename = 'Component.svelte'
} else {
  code = readFileSync(file_path, 'utf-8')
  filename = basename(file_path)
}

const client = create_mcp_client()

try {
  await client.initialize()

  const tool_args = {
    code,
    desired_svelte_version: version,
    filename,
  }

  const result = await client.call_tool('svelte-autofixer', tool_args)
  for (const item of result.content || []) {
    console.log(item.text || JSON.stringify(item))
  }
} catch (error) {
  console.error(`Error: ${error.message}`)
  process.exit(1)
} finally {
  client.close()
}

#!/usr/bin/env node

import { create_mcp_client } from './mcp-client.js'

const args = process.argv.slice(2)

if (args.length === 0) {
  console.log('Usage: svelte-docs.js [sections...]')
  console.log('')
  console.log('With no arguments, lists all available documentation sections.')
  console.log('With section name(s), fetches documentation for those sections.')
  console.log('')
  console.log('Examples:')
  console.log('  svelte-docs.js                    # List all sections')
  console.log('  svelte-docs.js "$state"            # Fetch $state docs')
  console.log('  svelte-docs.js routing "load functions"  # Fetch multiple')
  console.log('  svelte-docs.js cli/overview        # Fetch by path')
  process.exit(0)
}

const client = create_mcp_client()

try {
  await client.initialize()

  if (args[0] === '--list') {
    const result = await client.call_tool('list-sections', {})
    for (const item of result.content || []) {
      console.log(item.text || JSON.stringify(item))
    }
  } else {
    const section = args.length === 1 ? args[0] : args
    const result = await client.call_tool('get-documentation', { section })
    for (const item of result.content || []) {
      console.log(item.text || JSON.stringify(item))
    }
  }
} catch (error) {
  console.error(`Error: ${error.message}`)
  process.exit(1)
} finally {
  client.close()
}

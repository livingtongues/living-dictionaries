import { spawn } from 'node:child_process'

export function create_mcp_client() {
  const child = spawn('npx', ['-y', '@sveltejs/mcp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let buffer = ''
  let request_id = 0
  const pending = new Map()

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString()
    while (true) {
      const newline_index = buffer.indexOf('\n')
      if (newline_index === -1)
        break

      const line = buffer.slice(0, newline_index).trim()
      buffer = buffer.slice(newline_index + 1)

      if (!line)
        continue

      try {
        const message = JSON.parse(line)
        if (message.id !== undefined && pending.has(message.id)) {
          const { resolve, reject } = pending.get(message.id)
          pending.delete(message.id)
          if (message.error) {
            reject(new Error(message.error.message || JSON.stringify(message.error)))
          } else {
            resolve(message.result)
          }
        }
      } catch {}
    }
  })

  function send(method, params = {}) {
    const id = ++request_id
    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    child.stdin.write(`${message}\n`)
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
    })
  }

  async function initialize() {
    await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'svelte-skill', version: '1.0.0' },
    })
    send('notifications/initialized', {})
  }

  async function call_tool(name, args = {}) {
    const result = await send('tools/call', { name, arguments: args })
    return result
  }

  function close() {
    child.kill()
  }

  return { initialize, call_tool, close }
}

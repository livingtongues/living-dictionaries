import type { WebSocket } from 'ws'
import { ConnectionManager } from './connection-manager'

function websocket() {
  return {
    readyState: 1,
    close() { return undefined },
  } as WebSocket
}

describe(ConnectionManager, () => {
  test('keeps a replacement connection when the old socket closes late', () => {
    const manager = new ConnectionManager()
    const old_socket = websocket()
    const new_socket = websocket()

    manager.set_websocket('admin@example.com', old_socket)
    manager.set_websocket('admin@example.com', new_socket)
    manager.remove_websocket('admin@example.com', old_socket)

    expect(manager.has_browser('admin@example.com')).toBeTruthy()

    manager.remove_websocket('admin@example.com', new_socket)
    expect(manager.has_browser('admin@example.com')).toBeFalsy()
  })
})

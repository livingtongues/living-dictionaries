import type { DictConnection } from './worker-connection'
import { create_dict_live_db } from './dict-live-db.svelte'

function fake_connection(): DictConnection {
  const noop_unsubscribe = () => undefined
  return {
    dict_id: 'test-dict',
    is_opfs_backed: false,
    has_leader: () => true,
    query: () => Promise.resolve([]),
    execute: () => Promise.resolve(),
    dict_write: () => Promise.resolve({ result: undefined } as never),
    exec_raw: () => Promise.reject(new Error('n/a')),
    close: () => Promise.resolve(),
    delete_db: () => Promise.resolve(),
    subscribe_broadcasts: () => noop_unsubscribe,
    sync_now: () => Promise.resolve(),
  }
}

describe(create_dict_live_db, () => {
  // Regression: the proxy `get` trap must resolve getters with `target` as the
  // receiver, not the proxy — otherwise `get writes()` reading `this.#writes`
  // throws a private-field brand error and EVERY .writes op (insert_entry,
  // insert_sentence, media, junctions) breaks on the live editor.
  test('exposes the #writes-backed getter through the proxy without throwing', () => {
    const db = create_dict_live_db(fake_connection())
    expect(typeof db.writes.insert_entry).toBe('function')
    expect(typeof db.writes.link_junction).toBe('function')
  })
})

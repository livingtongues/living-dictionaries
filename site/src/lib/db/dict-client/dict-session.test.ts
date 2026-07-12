import type { Mock } from 'vitest'
import type { DictConnection } from './worker-connection'
import type { TranslateFunction } from '$lib/i18n/types'
import { _reset_for_tests, get_dict_session, replace_orama_watcher } from './dict-session'
import { _reset_snapshot_expired_tracker_for_tests, snapshot_expired_recently } from './snapshot-expired-tracker'
import { toast } from '$lib/state/toast.svelte'

vi.mock('$lib/state/toast.svelte', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}))

type Broadcast = { type: string } & Record<string, unknown>

function make_connection() {
  const handlers: ((broadcast: Broadcast) => void)[] = []
  const connection = {
    subscribe_broadcasts: (handler: (broadcast: Broadcast) => void) => {
      handlers.push(handler)
      return () => undefined
    },
    sync_now: vi.fn(() => Promise.resolve()),
  } as unknown as DictConnection
  return {
    connection,
    emit: (broadcast: Broadcast) => { for (const handler of [...handlers]) handler(broadcast) },
  }
}

const t: TranslateFunction = ((key: string) => key) as TranslateFunction

function make_deps({ connection, reload = vi.fn() }: { connection: DictConnection, reload?: Mock }) {
  const open_dict = vi.fn(() => Promise.resolve(connection))
  return { deps: { open_dict, is_browser: true, enable_dev_live_share: false, reload }, open_dict, reload }
}

describe(get_dict_session, () => {
  beforeEach(() => {
    _reset_for_tests()
    _reset_snapshot_expired_tracker_for_tests()
    vi.clearAllMocks()
  })

  test('returns null on the server and never opens a transport', async () => {
    const { connection } = make_connection()
    const { deps, open_dict } = make_deps({ connection })
    const session = await get_dict_session({ dict_id: 'ssr', can_edit: true, user_id: 'user-1', t }, { ...deps, is_browser: false })
    expect(session).toBe(null)
    expect(open_dict).not.toHaveBeenCalled()
  })

  test('caches the session per dict and fires the initial sync once', async () => {
    const { connection } = make_connection()
    const { deps, open_dict } = make_deps({ connection })
    const first = await get_dict_session({ dict_id: 'cache', can_edit: false, user_id: 'user-1', t }, deps)
    const second = await get_dict_session({ dict_id: 'cache', can_edit: false, user_id: 'user-1', t }, deps)
    expect(second).toBe(first)
    expect(open_dict).toHaveBeenCalledTimes(1)
    expect(open_dict).toHaveBeenCalledWith({ dict_id: 'cache', has_editor_role: false, auth: {} })
    expect((connection.sync_now as Mock)).toHaveBeenCalledTimes(1)
  })

  test('re-asserts the editor capability when a cached session gains edit rights', async () => {
    const { connection } = make_connection()
    const { deps, open_dict } = make_deps({ connection })
    await get_dict_session({ dict_id: 'promote', can_edit: false, user_id: 'user-1', t }, deps)
    await get_dict_session({ dict_id: 'promote', can_edit: true, user_id: 'user-1', t }, deps)
    expect(open_dict).toHaveBeenCalledTimes(2)
    expect(open_dict).toHaveBeenLastCalledWith({ dict_id: 'promote', has_editor_role: true, auth: {} })
  })

  test('re-stamps the audit user on every cache hit (login/logout mid-session)', async () => {
    const { connection } = make_connection()
    const { deps } = make_deps({ connection })
    const session = await get_dict_session({ dict_id: 'stamp', can_edit: false, user_id: 'user-1', t }, deps)
    const set_user_id = vi.spyOn(session.dict_db, 'set_user_id')
    await get_dict_session({ dict_id: 'stamp', can_edit: false, user_id: 'user-2', t }, deps)
    expect(set_user_id).toHaveBeenCalledWith('user-2')
  })

  test('schema_outdated recovers once — a second broadcast is ignored', async () => {
    const { connection, emit } = make_connection()
    const { deps, reload } = make_deps({ connection })
    await get_dict_session({ dict_id: 'schema', can_edit: false, user_id: 'user-1', t }, deps)
    emit({ type: 'schema_outdated' })
    emit({ type: 'schema_outdated' })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  test('snapshot_expired marks the tracker and toasts once', async () => {
    const { connection, emit } = make_connection()
    const { deps } = make_deps({ connection })
    await get_dict_session({ dict_id: 'expired', can_edit: false, user_id: 'user-1', t }, deps)
    emit({ type: 'snapshot_expired' })
    emit({ type: 'snapshot_expired' })
    expect(snapshot_expired_recently('expired')).toBeTruthy()
    expect(toast).toHaveBeenCalledTimes(1)
    expect((toast as unknown as Mock).mock.calls[0][0]).toBe('misc.local_data_expired')
  })

  test('sync_halted toasts once', async () => {
    const { connection, emit } = make_connection()
    const { deps } = make_deps({ connection })
    await get_dict_session({ dict_id: 'halted', can_edit: false, user_id: 'user-1', t }, deps)
    emit({ type: 'sync_halted' })
    emit({ type: 'sync_halted' })
    expect(toast).toHaveBeenCalledTimes(1)
    expect((toast as unknown as Mock).mock.calls[0][0]).toBe('misc.sync_paused_repeated_failure')
  })
})

describe(replace_orama_watcher, () => {
  beforeEach(() => _reset_for_tests())

  test('stops the previous watcher before installing the replacement', () => {
    const first = { stop: vi.fn() }
    const second = { stop: vi.fn() }
    replace_orama_watcher({ dict_id: 'watch', make: () => first })
    expect(first.stop).not.toHaveBeenCalled()
    replace_orama_watcher({ dict_id: 'watch', make: () => second })
    expect(first.stop).toHaveBeenCalledTimes(1)
    expect(second.stop).not.toHaveBeenCalled()
  })

  test('watchers are keyed per dict', () => {
    const one = { stop: vi.fn() }
    const other = { stop: vi.fn() }
    replace_orama_watcher({ dict_id: 'dict-a', make: () => one })
    replace_orama_watcher({ dict_id: 'dict-b', make: () => other })
    expect(one.stop).not.toHaveBeenCalled()
  })
})

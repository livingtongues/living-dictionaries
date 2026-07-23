import { TranslateStore } from './translate-store.svelte'

const api_translate_data_mock = vi.hoisted(() => vi.fn())
const api_translate_save_mock = vi.hoisted(() => vi.fn())
const toast_error_mock = vi.hoisted(() => vi.fn())

vi.mock('$api/translate/data/_call', () => ({ api_translate_data: api_translate_data_mock }))
vi.mock('$api/translate/save/_call', () => ({ api_translate_save: api_translate_save_mock }))
vi.mock('$api/translate/approve/_call', () => ({ api_translate_approve: vi.fn() }))
vi.mock('$api/translate/summary/_call', () => ({ api_translate_summary: vi.fn() }))
vi.mock('$lib/state/toast.svelte', () => ({ toast: { error: toast_error_mock } }))

const spanish_row = { key_id: 'page.title', en_value: 'Title', en_updated_at: '', value: 'Título', source: 'human' as const, needs_review: null, updated_at: '', updated_by_name: null }

describe(TranslateStore, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('commits locale and rows together only after a successful switch', async () => {
    api_translate_data_mock
      .mockResolvedValueOnce({ data: { rows: [spanish_row] }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
    const store = new TranslateStore()

    await store.load_locale('es')
    await store.load_locale('fr')

    expect(store.requested_locale).toBe('fr')
    expect(store.locale).toBe('')
    expect(store.rows).toEqual([])
    expect(toast_error_mock).toHaveBeenCalledOnce()
  })

  test('a save after a failed switch cannot write old rows under the requested locale', async () => {
    api_translate_data_mock
      .mockResolvedValueOnce({ data: { rows: [spanish_row] }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
    api_translate_save_mock.mockResolvedValue({ data: { row: null }, error: null })
    const store = new TranslateStore()

    await store.load_locale('es')
    await store.load_locale('fr')
    const saved = await store.save({ key_id: spanish_row.key_id, value: spanish_row.value })

    expect(saved).toBeFalsy()
    expect(api_translate_save_mock).not.toHaveBeenCalled()
  })

  test('suppresses a stale response without changing the successful snapshot', async () => {
    let resolve_french: (value: unknown) => void = () => undefined
    const french = new Promise((resolve) => { resolve_french = resolve })
    api_translate_data_mock
      .mockReturnValueOnce(french)
      .mockResolvedValueOnce({ data: { rows: [spanish_row] }, error: null })
    const store = new TranslateStore()

    const old_request = store.load_locale('fr')
    await store.load_locale('es')
    resolve_french({ data: { rows: [] }, error: null })
    await old_request

    expect(store.locale).toBe('es')
    expect(store.rows).toEqual([spanish_row])
  })
})

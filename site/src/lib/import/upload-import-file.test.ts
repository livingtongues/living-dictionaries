import type { SourceFileRow } from '$lib/db/server/source-files'
import { get } from 'svelte/store'
import { api_dict_file_confirm, api_dict_files_register } from '$api/v1/dictionaries/[id]/files/_call'
import { log_event } from '$lib/debug/remote-log'
import { IMPORT_UPLOAD_FAILED } from './constants'
import { upload_import_file } from './upload-import-file'

vi.mock('$api/v1/dictionaries/[id]/files/_call', () => ({
  api_dict_file_confirm: vi.fn(),
  api_dict_files_register: vi.fn(),
}))
vi.mock('$lib/debug/remote-log', () => ({ log_event: vi.fn() }))

const mocked_confirm = vi.mocked(api_dict_file_confirm)
const mocked_register = vi.mocked(api_dict_files_register)
const mocked_log_event = vi.mocked(log_event)

class FakeXHR {
  static instances: FakeXHR[] = []
  status = 0
  aborted = false
  opened: { method: string, url: string } | null = null
  headers: Record<string, string> = {}
  sent: unknown = null
  upload: { addEventListener: (type: string, callback: (event: { lengthComputable: boolean, loaded: number, total: number }) => void) => void }
  private listeners: Record<string, () => void> = {}
  private upload_listeners: Record<string, (event: { lengthComputable: boolean, loaded: number, total: number }) => void> = {}

  constructor() {
    FakeXHR.instances.push(this)
    this.upload = {
      addEventListener: (type, callback) => {
        this.upload_listeners[type] = callback
      },
    }
  }

  addEventListener(type: string, callback: () => void) {
    this.listeners[type] = callback
  }

  open(method: string, url: string) {
    this.opened = { method, url }
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }

  send(body: unknown) {
    this.sent = body
  }

  abort() {
    this.aborted = true
    this.listeners.abort?.()
  }

  emit_progress(loaded: number, total: number) {
    this.upload_listeners.progress?.({ lengthComputable: true, loaded, total })
  }

  finish(status: number) {
    this.status = status
    this.listeners.load?.()
  }

  fail() {
    this.listeners.error?.()
  }
}

vi.stubGlobal('XMLHttpRequest', FakeXHR)

const source_file: SourceFileRow = {
  id: 'file-1',
  dictionary_id: 'demo',
  source_id: null,
  filename: 'scan.pdf',
  mimetype: 'application/pdf',
  size_bytes: 5,
  storage_key: 'import/demo/file-1',
  import_instructions: null,
  source_note: null,
  upload_confirmed_at: null,
  import_requested_at: null,
  import_thread_id: null,
  uploaded_by_user_id: 'user-1',
  created_at: '2026-07-21T00:00:00Z',
  updated_at: '2026-07-21T00:00:00Z',
}

const test_file = () => new File(['bytes'], 'scan.pdf', { type: 'application/pdf' })

function register_ok() {
  mocked_register.mockResolvedValue({
    data: { file: source_file, upload_url: 'https://r2.example/upload' },
    error: null,
  })
}

function confirm_ok() {
  mocked_confirm.mockResolvedValue({
    data: { file: { ...source_file, upload_confirmed_at: '2026-07-21T00:01:00Z' } },
    error: null,
  })
}

async function latest_xhr(): Promise<FakeXHR> {
  await vi.waitFor(() => expect(FakeXHR.instances).toHaveLength(1))
  return FakeXHR.instances[0]
}

beforeEach(() => {
  FakeXHR.instances = []
  mocked_confirm.mockReset()
  mocked_register.mockReset()
  mocked_log_event.mockReset()
})

describe(upload_import_file, () => {
  test('uploads, confirms, and reaches 100 percent', async () => {
    register_ok()
    confirm_ok()
    const handle = upload_import_file({ file: test_file(), dictionary_id: 'demo' })
    const xhr = await latest_xhr()
    expect(xhr.opened).toEqual({ method: 'PUT', url: 'https://r2.example/upload' })
    expect(xhr.headers).toEqual({ 'Content-Type': 'application/pdf' })
    xhr.emit_progress(5, 5)
    expect(get(handle.progress)).toBe(99)
    xhr.finish(200)
    await expect(handle.done).resolves.toMatchObject({ id: 'file-1', upload_confirmed_at: '2026-07-21T00:01:00Z' })
    expect(get(handle.progress)).toBe(100)
    expect(mocked_log_event).not.toHaveBeenCalled()
  })

  test('logs an upload network failure with file and stage context', async () => {
    register_ok()
    const handle = upload_import_file({ file: test_file(), dictionary_id: 'demo' })
    const xhr = await latest_xhr()
    xhr.fail()
    await expect(handle.done).rejects.toThrow('Failed to upload file.')
    await vi.waitFor(() => expect(mocked_log_event).toHaveBeenCalledOnce())
    expect(mocked_log_event).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      message: IMPORT_UPLOAD_FAILED,
      context: {
        dictionary_id: 'demo',
        file_id: 'file-1',
        filename_extension: 'pdf',
        bytes: 5,
        stage: 'upload',
        failure_kind: 'network',
        status: 0,
        upload_target: 'object_storage',
        online: undefined,
        error_message: 'Failed to upload file.',
      },
    }))
  })

  test('logs registration API failures before an XHR exists', async () => {
    mocked_register.mockResolvedValue({ data: null, error: { status: 403, message: 'not allowed' } })
    const handle = upload_import_file({ file: test_file(), dictionary_id: 'demo' })
    await expect(handle.done).rejects.toThrow('not allowed')
    await vi.waitFor(() => expect(mocked_log_event).toHaveBeenCalledOnce())
    expect(FakeXHR.instances).toHaveLength(0)
    expect(mocked_log_event).toHaveBeenCalledWith(expect.objectContaining({
      message: IMPORT_UPLOAD_FAILED,
      context: expect.objectContaining({ stage: 'register', failure_kind: 'api_error', status: 403, file_id: null }),
    }))
  })

  test('logs confirmation API failures after the PUT succeeds', async () => {
    register_ok()
    mocked_confirm.mockResolvedValue({ data: null, error: { status: 400, message: 'object missing' } })
    const handle = upload_import_file({ file: test_file(), dictionary_id: 'demo' })
    const xhr = await latest_xhr()
    xhr.finish(200)
    await expect(handle.done).rejects.toThrow('object missing')
    await vi.waitFor(() => expect(mocked_log_event).toHaveBeenCalledOnce())
    expect(mocked_log_event).toHaveBeenCalledWith(expect.objectContaining({
      message: IMPORT_UPLOAD_FAILED,
      context: expect.objectContaining({ stage: 'confirm', failure_kind: 'api_error', status: 400, file_id: 'file-1' }),
    }))
  })

  test('does not log a user-aborted upload as a critical failure', async () => {
    register_ok()
    const handle = upload_import_file({ file: test_file(), dictionary_id: 'demo' })
    const xhr = await latest_xhr()
    handle.abort()
    expect(xhr.aborted).toBeTruthy()
    await expect(handle.done).rejects.toThrow('Upload aborted.')
    await Promise.resolve()
    expect(mocked_log_event).not.toHaveBeenCalled()
  })
})

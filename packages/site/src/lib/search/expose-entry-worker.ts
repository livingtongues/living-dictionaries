import { type Remote, wrap } from 'comlink'

const worker = new Worker(new URL('./entry.worker.ts', import.meta.url), { type: 'module' })
export const api: Remote<typeof import('./entry.worker').api> = wrap(worker)

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * One line per finished VPS deploy, appended by the instrumented `deploy.sh`
 * (generated in vps-setup `bin/sync`) to `<DATA_DIR>/deploy-metrics.jsonl` —
 * the host's /opt/hosting/data bind-mounted at /data. Phase keys are optional:
 * backfilled journal records carry only totals + waits. Rendered by the
 * /admin/health "Deploys" panel.
 */
export interface DeployMetric {
  at: string
  machine: string
  outcome: 'complete' | 'failed'
  sha?: string
  total_s?: number
  pull_s?: number
  preflight_s?: number
  build_s?: number
  rollout_s?: number
  green_wait_s?: number
  blue_wait_s?: number
  backfilled?: boolean
}

const MAX_RECORDS = 120

export function read_deploy_metrics(): DeployMetric[] {
  const file_path = join(process.env.DATA_DIR || '.data', 'deploy-metrics.jsonl')
  if (!existsSync(file_path))
    return []
  const records: DeployMetric[] = []
  for (const line of readFileSync(file_path, 'utf8').split('\n')) {
    if (!line.trim())
      continue
    try {
      records.push(JSON.parse(line))
    } catch {
      // skip malformed lines — the file is append-only from shell
    }
  }
  records.sort((first, second) => first.at.localeCompare(second.at))
  return records.slice(-MAX_RECORDS)
}

if (import.meta.vitest) {
  describe(read_deploy_metrics, () => {
    it('reads, sorts, and skips malformed lines; empty when file missing', () => {
      const prev_data_dir = process.env.DATA_DIR
      const dir = mkdtempSync(join(tmpdir(), 'deploy-metrics-'))
      process.env.DATA_DIR = dir
      try {
        expect(read_deploy_metrics()).toEqual([])
        writeFileSync(join(dir, 'deploy-metrics.jsonl'), [
          '{"at":"2026-07-09T05:51:13Z","machine":"house","outcome":"complete","total_s":191,"build_s":150}',
          'not json',
          '{"at":"2026-07-08T01:00:00Z","machine":"house","outcome":"failed","total_s":40}',
          '',
        ].join('\n'))
        const records = read_deploy_metrics()
        expect(records).toHaveLength(2)
        expect(records[0].at).toBe('2026-07-08T01:00:00Z')
        expect(records[1].build_s).toBe(150)
      } finally {
        if (prev_data_dir === undefined)
          delete process.env.DATA_DIR
        else
          process.env.DATA_DIR = prev_data_dir
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })
}

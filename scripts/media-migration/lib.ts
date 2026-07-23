/**
 * Shared plumbing for the GCS→R2 media migration driver (run from mustang).
 *
 * Secrets policy: NOTHING stored here.
 *  - Source (primary): poly R2 mirror `backups-rolling/mirror/gcs-living/` —
 *    creds parsed from mustang's own `~/.config/rclone/rclone.conf` `[r2]` remote.
 *  - Source (fallback): public firebasestorage `?alt=media` URL (no creds).
 *  - Destination: LD-account `livingdictionaries-media` — creds pulled at runtime
 *    over fleet SSH from living's `/opt/hosting/sveltekit/.env` (account-wide
 *    Object R/W token, same pattern as vps-setup's backup-media GCS leg).
 */
import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { S3Client } from '@aws-sdk/client-s3'
import Database from 'better-sqlite3'

export const execute_file = promisify(execFile)

export const MEDIA_BUCKET = 'livingdictionaries-media'
export const MIRROR_BUCKET = 'backups-rolling'
export const MIRROR_PREFIX = 'mirror/gcs-living/'
export const GCS_BUCKET = 'talking-dictionaries-alpha.appspot.com'
export const STATE_DB_PATH = join(import.meta.dirname, 'state.db')
/** Bind-mounted into the app container at /data — how we hand files to docker-exec'd node. */
export const VPS_DATA_DIR = '/opt/hosting/data'

export function gcs_public_url(old_path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${GCS_BUCKET}/o/${encodeURIComponent(old_path)}?alt=media`
}

export async function ssh_living(command: string, options: { max_buffer_mb?: number } = {}): Promise<string> {
  const { stdout } = await execute_file(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', 'living', command],
    { maxBuffer: (options.max_buffer_mb ?? 256) * 1024 * 1024 },
  )
  return stdout
}

/** Run a node program inside the app container (program via stdin, like the ops skill). */
export async function docker_exec_node({ program, max_buffer_mb }: { program: string, max_buffer_mb?: number }): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = execFile(
      'ssh',
      ['-o', 'BatchMode=yes', 'living', 'docker exec -i sveltekit_blue node'],
      { maxBuffer: (max_buffer_mb ?? 256) * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err)
          reject(new Error(`docker exec node failed: ${err.message}\n${stderr}`))
        else resolve(stdout)
      },
    )
    child.stdin.write(program)
    child.stdin.end()
  })
}

function parse_rclone_remote(name: string): Record<string, string> {
  const conf = readFileSync(join(homedir(), '.config/rclone/rclone.conf'), 'utf8')
  const lines = conf.split('\n')
  const values: Record<string, string> = {}
  let in_section = false
  for (const line of lines) {
    const section = line.match(/^\[(.+)\]$/)
    if (section) {
      in_section = section[1] === name
      continue
    }
    if (!in_section)
      continue
    const kv = line.match(/^(\w+)\s*=\s*(.+)$/)
    if (kv)
      values[kv[1]] = kv[2].trim()
  }
  return values
}

/** Poly-account S3 client (source mirror reads). */
export function get_poly_r2_client(): S3Client {
  const remote = parse_rclone_remote('r2')
  if (!remote.access_key_id || !remote.secret_access_key || !remote.endpoint)
    throw new Error('rclone [r2] remote missing access_key_id/secret_access_key/endpoint')
  return new S3Client({
    region: 'auto',
    endpoint: remote.endpoint,
    credentials: { accessKeyId: remote.access_key_id, secretAccessKey: remote.secret_access_key },
  })
}

/** LD-account S3 client (media-bucket writes) — creds pulled over SSH at runtime. */
export async function get_ld_r2_client(): Promise<S3Client> {
  const raw = await ssh_living(`grep -E '^(R2_ACCOUNT_ID|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY)=' /opt/hosting/sveltekit/.env`)
  const values: Record<string, string> = {}
  for (const line of raw.trim().split('\n')) {
    const idx = line.indexOf('=')
    values[line.slice(0, idx)] = line.slice(idx + 1)
  }
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = values
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)
    throw new Error('Could not pull R2 creds from living env')
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  })
}

export function get_state_db(): Database.Database {
  const db = new Database(STATE_DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS objects (
      dict_id TEXT NOT NULL,
      tbl TEXT NOT NULL,             -- 'audio' | 'videos'
      row_id TEXT NOT NULL,
      old_path TEXT NOT NULL,
      new_key TEXT NOT NULL,
      bytes INTEGER,
      content_type TEXT,
      source TEXT,                   -- 'mirror' | 'gcs'
      status TEXT NOT NULL DEFAULT 'pending', -- pending | copied | missing | error | rewritten
      error TEXT,
      copied_at TEXT,
      rewritten_at TEXT,
      PRIMARY KEY (tbl, row_id)
    );
    CREATE INDEX IF NOT EXISTS idx_objects_dict ON objects(dict_id);
    CREATE INDEX IF NOT EXISTS idx_objects_status ON objects(status);
    CREATE TABLE IF NOT EXISTS dicts (
      dict_id TEXT PRIMARY KEY,
      manifested_at TEXT,
      verified_at TEXT,
      rewritten_at TEXT
    );
    -- Photo WebP variants (thumb/w900/w1600) generated during the photo copy —
    -- byte sizes recorded for verify + the media_objects ledger seed.
    CREATE TABLE IF NOT EXISTS variants (
      tbl TEXT NOT NULL,
      row_id TEXT NOT NULL,
      variant TEXT NOT NULL,
      key TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      PRIMARY KEY (tbl, row_id, variant)
    );
  `)
  return db
}

export function iso_now(): string {
  return new Date().toISOString()
}

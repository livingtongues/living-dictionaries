import type { Plugin } from 'vite'
import { appendFileSync, writeFileSync } from 'node:fs'

const LOG_FILE = '.dev-server.log'

export function dev_log_plugin(): Plugin {
  return {
    name: 'dev-log',
    apply: 'serve',

    configureServer(server) {
      writeFileSync(LOG_FILE, '')

      const original_info = server.config.logger.info
      const original_warn = server.config.logger.warn
      const original_error = server.config.logger.error

      server.config.logger.info = (msg, options) => {
        append_log(msg)
        original_info(msg, options)
      }

      server.config.logger.warn = (msg, options) => {
        append_log(`[warn] ${msg}`)
        original_warn(msg, options)
      }

      server.config.logger.error = (msg, options) => {
        append_log(`[error] ${msg}`)
        original_error(msg, options)
      }
    },
  }
}

function append_log(message: string) {
  try {
    // eslint-disable-next-line no-control-regex
    const clean = message.replace(/\x1B\[[0-9;]*m/g, '')
    appendFileSync(LOG_FILE, `${clean}\n`)
  } catch {}
}

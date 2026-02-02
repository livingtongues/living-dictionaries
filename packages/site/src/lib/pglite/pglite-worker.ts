import { PGlite } from '@electric-sql/pglite'
import { live } from '@electric-sql/pglite/live'
import { vector } from '@electric-sql/pglite/vector'
import { type PGliteWorkerOptions, worker } from '@electric-sql/pglite/worker'

worker({
  // eslint-disable-next-line require-await
  async init(options: PGliteWorkerOptions) {
    const { dataDir } = options

    const pg = new PGlite({
      dataDir,
      relaxedDurability: true,
      extensions: {
        live,
        vector,
      },
    })

    return pg
  },
})

import type { InferSelectModel } from 'drizzle-orm'
import type * as schema from './schema'

export type Migration = InferSelectModel<typeof schema.migrations>
export type DbMetadata = InferSelectModel<typeof schema.db_metadata>

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/pglite/schema.ts',
  dbCredentials: {
    url: 'postgres://postgres@localhost:5432/postgres',
  },
})

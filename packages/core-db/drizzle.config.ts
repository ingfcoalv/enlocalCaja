import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: 'localhost',
    port: 5432,
    database: process.env.DB_NAME || 'enlocal_caja',
    user: 'enlocal',
    password: 'enlocal',
    ssl: false,
  },
})

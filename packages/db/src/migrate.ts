/**
 * Script d'application des migrations Drizzle.
 * Exécution : pnpm db:migrate
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

// Charge .env.local depuis la racine du monorepo
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env.local') })
config({ path: resolve(__dirname, '../../../.env') })

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('❌ DATABASE_URL is required')
  process.exit(1)
}

console.info('🔄 Connexion à la base...')
const sql = postgres(connectionString, { max: 1 })
const db = drizzle(sql)

console.info('🔄 Application des migrations...')
await migrate(db, { migrationsFolder: './migrations' })
console.info('✅ Migrations appliquées avec succès')

await sql.end()
process.exit(0)

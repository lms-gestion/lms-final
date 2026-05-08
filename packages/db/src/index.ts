/**
 * @lms/db — Point d'entrée principal
 *
 * Usage côté serveur :
 *   import { db, schema } from '@lms/db'
 *   const orgs = await db.select().from(schema.organizations)
 *
 * Pour les types :
 *   import type { Chantier, Invoice } from '@lms/db/types'
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required for @lms/db')
}

// Connection pool : Supabase recommande pgBouncer en prod (port 6543), direct pour migrations (5432)
const queryClient = postgres(connectionString, {
  prepare: false, // Compatible pgBouncer transaction mode
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(queryClient, { schema, logger: process.env.NODE_ENV === 'development' })

export { schema }
export * from './schema'
export * from './types'

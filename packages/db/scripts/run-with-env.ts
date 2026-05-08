/**
 * Petit wrapper qui charge .env.local avant d'exécuter une commande.
 * Utilisé pour drizzle-kit qui ne lit pas .env.local automatiquement.
 *
 * Usage : tsx scripts/run-with-env.ts <command> <args...>
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env.local') })
config({ path: resolve(__dirname, '../../../.env') })

const [, , command, ...args] = process.argv
if (!command) {
  console.error('Usage: tsx run-with-env.ts <command> [args...]')
  process.exit(1)
}

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
})
child.on('exit', (code) => process.exit(code ?? 0))

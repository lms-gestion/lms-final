/**
 * Script de seed : crée des données de démo pour tester en local.
 * Exécution : pnpm db:seed
 *
 * Crée :
 * - 1 organisation "La Maison des Services"
 * - 3 agences (Montpellier, Perpignan, Aix-Marseille)
 * - Colonnes Kanban par défaut
 * - Quelques tarifs de référence
 *
 * NE PAS exécuter sur une base de production avec des données réelles.
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Charge .env.local depuis la racine du monorepo
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env.local') })
config({ path: resolve(__dirname, '../../../.env') })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('❌ DATABASE_URL is required')
  process.exit(1)
}

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Refus d\'exécuter le seed en production')
  process.exit(1)
}

const sql = postgres(connectionString)
const db = drizzle(sql, { schema })

console.info('🌱 Création de l\'organisation de démo...')

const [org] = await db
  .insert(schema.organizations)
  .values({
    slug: 'lms-demo',
    name: 'La Maison des Services',
    legalName: 'La Maison des Services SAS',
    siret: '12345678901234',
    tvaIntra: 'FR12345678901',
    legalForm: 'SAS',
    apeCode: '4322A',
    address: {
      street: '420 av. Blaise Pascal',
      postalCode: '34170',
      city: 'Castelnau-le-Lez',
      country: 'FR',
    },
    phone: '04 65 84 15 94',
    email: 'contact@lamaisondesservices.fr',
    website: 'https://lamaisondesservices.fr',
  })
  .returning()

if (!org) throw new Error('Échec création organisation')
console.info(`  ✓ Organisation : ${org.name} (${org.id})`)

await db.insert(schema.organizationSettings).values({
  organizationId: org.id,
  branding: {
    primaryColor: '#0F2644',
    accentColor: '#F5A623',
    ctaColor: '#F97316',
    fontFamily: 'Inter',
  },
  documentDefaults: {
    paymentTermsDays: 30,
    quoteValidityDays: 30,
    latePenaltyRatePct: 18.0,
    lateIndemnityEur: 40,
  },
  aiSettings: {
    enabled: true,
    monthlyCapEur: 100,
    enabledTypes: ['bc', 'facture', 'attestation', 'photo', 'text'],
  },
  securitySettings: {
    mfaRequiredRoles: ['owner', 'admin', 'accountant'],
    sessionTimeoutMinutes: 60,
    rememberMeDays: 30,
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireNumber: true,
      requireSpecial: true,
    },
  },
  pricingLibrary: {
    laborRates: [
      { code: 'MO_PLOMB', label: 'MO Plomberie technicien', unit: 'h', unitPriceHt: 65 },
      { code: 'MO_ELEC', label: 'MO Électricité technicien', unit: 'h', unitPriceHt: 70 },
    ],
    travelRates: [
      { code: 'DEP_LOC', label: 'Déplacement local (<15 km)', unit: 'forfait', unitPriceHt: 35 },
    ],
    materials: [],
  },
  accountingSettings: {
    salesAccount: '706000',
    purchaseAccount: '604000',
    vatCollectedAccount: '445710',
    vatDeductibleAccount: '445660',
    clientAccount: '411000',
    supplierAccount: '401000',
  },
  onboardingState: { completedAt: new Date().toISOString(), currentStep: 4 },
})

console.info('🌱 Création des agences...')

const [montpellier, perpignan, aix] = await db
  .insert(schema.agencies)
  .values([
    {
      organizationId: org.id,
      name: 'Montpellier',
      code: 'MTP',
      address: {
        street: '420 av. Blaise Pascal',
        postalCode: '34170',
        city: 'Castelnau-le-Lez',
      },
      phone: '04 65 84 15 94',
      postalCodes: ['34000', '34070', '34080', '34170', '34970', '34290'],
      metiers: ['plomberie', 'electricite', 'toiture', 'serrurerie', 'menuiserie', 'peinture', 'maconnerie', 'syndics'],
      status: 'active',
    },
    {
      organizationId: org.id,
      name: 'Perpignan',
      code: 'PPN',
      address: { street: 'ZAC du Mas Balande, Route d\'Elne', postalCode: '66100', city: 'Perpignan' },
      postalCodes: ['66000', '66100', '66140', '66200'],
      metiers: ['plomberie', 'electricite', 'toiture', 'serrurerie', 'menuiserie', 'peinture', 'maconnerie'],
      status: 'active',
    },
    {
      organizationId: org.id,
      name: 'Aix-Marseille',
      code: 'AIX',
      address: { street: '49 chemin des Vieux Prés', postalCode: '84530', city: 'Villelaure' },
      postalCodes: ['13000', '13100', '13400'],
      metiers: ['plomberie', 'electricite', 'serrurerie'],
      status: 'opening_soon',
      openingDate: '2026-09-01',
    },
  ])
  .returning()

console.info(`  ✓ ${[montpellier, perpignan, aix].filter(Boolean).length} agences créées`)

console.info('🌱 Création des colonnes Kanban par défaut...')

await db.insert(schema.chantierColumns).values([
  {
    organizationId: org.id,
    position: 0,
    key: 'nouveau',
    label: 'Nouveau',
    emoji: '🆕',
    color: '#0ea5e9',
    bgColor: '#f0f9ff',
    borderColor: '#bae6fd',
    isInitial: true,
    isTerminal: false,
  },
  {
    organizationId: org.id,
    position: 1,
    key: 'planifie',
    label: 'Planifié',
    emoji: '📅',
    color: '#ffb020',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    isInitial: false,
    isTerminal: false,
  },
  {
    organizationId: org.id,
    position: 2,
    key: 'en_cours',
    label: 'En cours',
    emoji: '🔧',
    color: '#0f3b78',
    bgColor: '#e8f2ff',
    borderColor: '#bdd6f5',
    isInitial: false,
    isTerminal: false,
  },
  {
    organizationId: org.id,
    position: 3,
    key: 'termine',
    label: 'Terminé',
    emoji: '✅',
    color: '#16a34a',
    bgColor: '#dcfce7',
    borderColor: '#bbf7d0',
    isInitial: false,
    isTerminal: true,
  },
])

console.info(`  ✓ 4 colonnes Kanban créées`)

console.info('')
console.info('✅ Seed terminé.')
console.info('')
console.info('Prochaines étapes :')
console.info('  1. Créer ton compte owner via /signup avec un email')
console.info(`  2. Lier ton compte à l'organisation ${org.slug} en SQL :`)
console.info(`     INSERT INTO memberships (user_id, organization_id, role)`)
console.info(`     VALUES ('<ton-user-id>', '${org.id}', 'owner');`)
console.info('')

await sql.end()
process.exit(0)

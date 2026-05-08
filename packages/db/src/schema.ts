/**
 * @lms/db — Schéma Drizzle complet
 *
 * Multi-tenant : toutes les tables métier portent organization_id (FK).
 * Sécurité : les RLS policies sont dans infra/supabase/rls.sql.
 * Ne JAMAIS désactiver les RLS sans audit.
 *
 * Conventions :
 * - PK : uuid("id").primaryKey().defaultRandom()
 * - FK : références explicites avec onDelete
 * - Timestamps : createdAt + updatedAt automatiques
 * - Soft delete : archivedAt timestamp NULL = actif
 */

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  jsonb,
  inet,
  index,
  uniqueIndex,
  foreignKey,
  primaryKey,
  pgEnum,
  customType,
} from 'drizzle-orm/pg-core'

// ──────────────────────────────────────────────────────────────────
// ENUMS
// ──────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'owner',
  'admin',
  'accountant',
  'technician',
  'viewer',
])

export const clientTypeEnum = pgEnum('client_type', [
  'syndic',
  'bailleur',
  'copropriete',
  'assurance',
  'tertiaire',
  'hotellerie',
  'particulier',
])

export const chantierPriorityEnum = pgEnum('chantier_priority', ['normal', 'haute', 'urgence'])

export const interventionStatusEnum = pgEnum('intervention_status', [
  'planifiee',
  'en_cours',
  'terminee',
  'annulee',
  'reportee',
])

export const interventionTypeEnum = pgEnum('intervention_type', [
  'diagnostic',
  'reparation',
  'travaux',
  'controle',
  'urgence',
  'livraison',
  'autre',
])

export const quoteStatusEnum = pgEnum('quote_status', [
  'brouillon',
  'envoye',
  'consulte',
  'accepte',
  'refuse',
  'expire',
])

export const invoiceTypeEnum = pgEnum('invoice_type', [
  'standard',
  'avoir',
  'acompte',
  'situation',
  'solde',
  'proforma',
])

export const invoiceDirectionEnum = pgEnum('invoice_direction', ['sale', 'purchase'])

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'brouillon',
  'emise',
  'envoyee',
  'partiellement_payee',
  'payee',
  'annulee',
])

export const interventionOrderStatusEnum = pgEnum('io_status', [
  'brouillon',
  'pret_a_signer',
  'signe',
  'refuse',
  'expire',
  'facture',
])

export const supplierTypeEnum = pgEnum('supplier_type', [
  'donneur_ordre',
  'materiel',
  'sous_traitant',
  'autre',
])

export const documentTypeEnum = pgEnum('document_type', [
  'photo',
  'pdf',
  'doc',
  'xls',
  'attestation',
  'bc',
  'facture',
  'devis',
  'bi',
  'autre',
])

export const notificationSeverityEnum = pgEnum('notification_severity', [
  'info',
  'warning',
  'error',
  'success',
])

// ──────────────────────────────────────────────────────────────────
// CORE — Multi-tenant
// ──────────────────────────────────────────────────────────────────

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    legalName: text('legal_name'),
    siret: text('siret'),
    tvaIntra: text('tva_intra'),
    legalForm: text('legal_form'),
    capitalSocial: numeric('capital_social', { precision: 12, scale: 2 }),
    rcsNumber: text('rcs_number'),
    rcsCity: text('rcs_city'),
    apeCode: text('ape_code'),
    address: jsonb('address').$type<{
      street?: string
      postalCode?: string
      city?: string
      country?: string
    }>(),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    logoUrl: text('logo_url'),
    customDomain: text('custom_domain'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(t.slug),
    customDomainIdx: uniqueIndex('organizations_custom_domain_idx').on(t.customDomain),
  }),
)

export const organizationSettings = pgTable('organization_settings', {
  organizationId: uuid('organization_id')
    .primaryKey()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  branding: jsonb('branding').$type<{
    primaryColor?: string
    accentColor?: string
    ctaColor?: string
    fontFamily?: string
  }>(),
  documentDefaults: jsonb('document_defaults').$type<{
    paymentTermsDays?: number
    quoteValidityDays?: number
    latePenaltyRatePct?: number
    lateIndemnityEur?: number
    rcProNumber?: string
    rcProInsurer?: string
    decennaleNumber?: string
    decennaleInsurer?: string
    mediatorConsumer?: string
  }>(),
  kanbanSettings: jsonb('kanban_settings').$type<{
    autoCloseAfterCompletion?: boolean
    autoArchiveTerminalDays?: number
    urgentEscalationMinutes?: number
  }>(),
  aiSettings: jsonb('ai_settings').$type<{
    enabled?: boolean
    monthlyCapEur?: number
    enabledTypes?: string[]
  }>(),
  notificationSettings: jsonb('notification_settings').$type<{
    defaultQuoteReminders?: boolean
    defaultInvoiceReminders?: boolean
    sendReminderAtHour?: number
  }>(),
  securitySettings: jsonb('security_settings').$type<{
    mfaRequiredRoles?: string[]
    sessionTimeoutMinutes?: number
    rememberMeDays?: number
    passwordPolicy?: {
      minLength?: number
      requireUppercase?: boolean
      requireNumber?: boolean
      requireSpecial?: boolean
    }
  }>(),
  pricingLibrary: jsonb('pricing_library').$type<{
    laborRates?: Array<{ code: string; label: string; unit: string; unitPriceHt: number }>
    travelRates?: Array<{ code: string; label: string; unit: string; unitPriceHt: number }>
    materials?: Array<{ code: string; label: string; unit: string; unitPriceHt: number }>
  }>(),
  accountingSettings: jsonb('accounting_settings').$type<{
    salesAccount?: string
    purchaseAccount?: string
    vatCollectedAccount?: string
    vatDeductibleAccount?: string
    clientAccount?: string
    supplierAccount?: string
  }>(),
  onboardingState: jsonb('onboarding_state').$type<{
    completedAt?: string | null
    currentStep?: number
  }>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const users = pgTable('users', {
  // L'id correspond à auth.users.id de Supabase Auth (lien 1:1)
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  preferences: jsonb('preferences').$type<{
    locale?: string
    timezone?: string
    dateFormat?: string
    density?: 'compact' | 'comfort'
    theme?: 'light' | 'dark'
    defaultPage?: string
  }>(),
  icalToken: text('ical_token').unique(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
})

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull().default('viewer'),
    agencyIds: uuid('agency_ids').array(), // NULL = toutes agences
    isActive: boolean('is_active').notNull().default(true),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserOrg: uniqueIndex('memberships_user_org_idx').on(t.userId, t.organizationId),
    orgIdx: index('memberships_org_idx').on(t.organizationId),
  }),
)

export const agencies = pgTable(
  'agencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    address: jsonb('address').$type<{
      street?: string
      postalCode?: string
      city?: string
      lat?: number
      lng?: number
    }>(),
    phone: text('phone'),
    email: text('email'),
    managerId: uuid('manager_id').references(() => memberships.id, { onDelete: 'set null' }),
    postalCodes: text('postal_codes').array(),
    metiers: text('metiers').array(),
    status: text('status').notNull().default('active'), // 'active' | 'opening_soon' | 'closed'
    openingDate: date('opening_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    orgIdx: index('agencies_org_idx').on(t.organizationId),
    uniqCode: uniqueIndex('agencies_org_code_idx').on(t.organizationId, t.code),
  }),
)

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: userRoleEnum('role').notNull(),
    agencyIds: uuid('agency_ids').array(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    message: text('message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('invitations_org_idx').on(t.organizationId),
    emailIdx: index('invitations_email_idx').on(t.email),
  }),
)

// ──────────────────────────────────────────────────────────────────
// CRM — Clients, Contacts, Lieux, Fournisseurs
// ──────────────────────────────────────────────────────────────────

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: clientTypeEnum('type').notNull().default('particulier'),
    legalName: text('legal_name'),
    legalForm: text('legal_form'),
    siret: text('siret'),
    tvaIntra: text('tva_intra'),
    apeCode: text('ape_code'),
    cardProGT: text('card_pro_gt'), // pour syndics
    chorusProRequired: boolean('chorus_pro_required').default(false),
    chorusProServiceCode: text('chorus_pro_service_code'),
    address: jsonb('address').$type<{
      street?: string
      postalCode?: string
      city?: string
      country?: string
      lat?: number
      lng?: number
    }>(),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    primaryContactId: uuid('primary_contact_id'), // FK ajoutée plus bas (cycle)
    defaultAgencyId: uuid('default_agency_id').references(() => agencies.id, {
      onDelete: 'set null',
    }),
    paymentTermsDays: integer('payment_terms_days').default(30),
    paymentMethod: text('payment_method'), // virement | cheque | prelevement
    iban: text('iban'),
    bic: text('bic'),
    paymentStatusScore: integer('payment_status_score').default(100),
    paymentStatusOverride: text('payment_status_override'), // 'blocked' | NULL
    notes: text('notes'),
    tags: text('tags').array(),
    metadata: jsonb('metadata'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    mergedIntoId: uuid('merged_into_id'), // self-reference pour fusion
    archiveReason: text('archive_reason'),
    searchVector: text('search_vector'), // tsvector via trigger
  },
  (t) => ({
    orgIdx: index('clients_org_idx').on(t.organizationId),
    siretIdx: index('clients_siret_idx').on(t.siret),
    typeIdx: index('clients_type_idx').on(t.organizationId, t.type),
    nameIdx: index('clients_name_idx').on(t.organizationId, t.name),
  }),
)

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    civility: text('civility'), // M., Mme, autre
    fullName: text('full_name').notNull(),
    role: text('role'), // Gestionnaire, Comptable, Président...
    email: text('email'),
    phone: text('phone'),
    mobile: text('mobile'),
    isPrimary: boolean('is_primary').default(false),
    communicationPreference: text('communication_preference'), // email | sms | mobile
    availability: text('availability'),
    avatarUrl: text('avatar_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('contacts_org_idx').on(t.organizationId),
    clientIdx: index('contacts_client_idx').on(t.clientId),
  }),
)

export const clientLocations = pgTable(
  'client_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    internalCode: text('internal_code'),
    address: jsonb('address').$type<{
      street?: string
      postalCode?: string
      city?: string
      lat?: number
      lng?: number
      placeId?: string
    }>(),
    yearBuilt: integer('year_built'),
    lotsCount: integer('lots_count'),
    keeperContactId: uuid('keeper_contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    accessCode: text('access_code'), // chiffré applicativement
    accessNotes: text('access_notes'),
    tags: text('tags').array(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    orgIdx: index('client_locations_org_idx').on(t.organizationId),
    clientIdx: index('client_locations_client_idx').on(t.clientId),
  }),
)

export const technicians = pgTable(
  'technicians',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id').references(() => memberships.id, { onDelete: 'set null' }),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'restrict' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    avatarUrl: text('avatar_url'),
    trades: text('trades').array(), // ['plomberie', 'electricite']
    qualifications: jsonb('qualifications'),
    vehicle: text('vehicle'),
    isExternal: boolean('is_external').default(false),
    hireDate: date('hire_date'),
    terminationDate: date('termination_date'),
    hourlyCost: numeric('hourly_cost', { precision: 10, scale: 2 }),
    workSchedule: jsonb('work_schedule'),
    status: text('status').notNull().default('active'), // active | inactive
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('technicians_org_idx').on(t.organizationId),
    agencyIdx: index('technicians_agency_idx').on(t.agencyId),
    statusIdx: index('technicians_status_idx').on(t.organizationId, t.status),
  }),
)

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: supplierTypeEnum('type').notNull().default('autre'),
    legalName: text('legal_name'),
    siret: text('siret'),
    tvaIntra: text('tva_intra'),
    address: jsonb('address'),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    primaryContactName: text('primary_contact_name'),
    primaryContactRole: text('primary_contact_role'),
    primaryContactEmail: text('primary_contact_email'),
    primaryContactPhone: text('primary_contact_phone'),
    paymentTermsDays: integer('payment_terms_days').default(30),
    paymentMethod: text('payment_method'),
    iban: text('iban'),
    bic: text('bic'),
    notes: text('notes'),
    tags: text('tags').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    orgIdx: index('suppliers_org_idx').on(t.organizationId),
    siretIdx: index('suppliers_siret_idx').on(t.siret),
  }),
)

// ──────────────────────────────────────────────────────────────────
// CHANTIERS & KANBAN
// ──────────────────────────────────────────────────────────────────

export const chantierColumns = pgTable(
  'chantier_columns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    agencyId: uuid('agency_id').references(() => agencies.id, { onDelete: 'cascade' }), // NULL = toutes
    position: integer('position').notNull(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    emoji: text('emoji'),
    color: text('color'),
    bgColor: text('bg_color'),
    borderColor: text('border_color'),
    isInitial: boolean('is_initial').default(false),
    isTerminal: boolean('is_terminal').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('chantier_columns_org_idx').on(t.organizationId),
    uniqKey: uniqueIndex('chantier_columns_org_key_idx').on(t.organizationId, t.key),
  }),
)

export const chantiers = pgTable(
  'chantiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'restrict' }),
    reference: text('reference').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    locationId: uuid('location_id').references(() => clientLocations.id, {
      onDelete: 'set null',
    }),
    metier: text('metier').notNull(),
    priority: chantierPriorityEnum('priority').notNull().default('normal'),
    status: text('status').notNull(), // ID de la colonne kanban
    title: text('title').notNull(),
    description: text('description'),
    address: jsonb('address').$type<{
      street?: string
      postalCode?: string
      city?: string
      lat?: number
      lng?: number
    }>(),
    tenantName: text('tenant_name'),
    tenantPhone: text('tenant_phone'),
    tenantEmail: text('tenant_email'),
    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    supplierReference: text('supplier_reference'),
    assignedTechnicianId: uuid('assigned_technician_id').references(() => technicians.id, {
      onDelete: 'set null',
    }),
    scheduledDate: date('scheduled_date'),
    deadlineDate: date('deadline_date'),
    estimatedDurationHours: numeric('estimated_duration_hours', { precision: 6, scale: 2 }),
    tags: text('tags').array(),
    notes: text('notes'),
    metadata: jsonb('metadata'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    searchVector: text('search_vector'), // tsvector via trigger
  },
  (t) => ({
    orgIdx: index('chantiers_org_idx').on(t.organizationId),
    agencyIdx: index('chantiers_agency_idx').on(t.organizationId, t.agencyId),
    statusIdx: index('chantiers_status_idx').on(t.organizationId, t.status),
    clientIdx: index('chantiers_client_idx').on(t.clientId),
    techIdx: index('chantiers_tech_idx').on(t.assignedTechnicianId),
    refIdx: uniqueIndex('chantiers_org_ref_idx').on(t.organizationId, t.reference),
    priorityIdx: index('chantiers_priority_idx').on(t.organizationId, t.priority),
  }),
)

// ──────────────────────────────────────────────────────────────────
// INTERVENTIONS
// ──────────────────────────────────────────────────────────────────

export const interventions = pgTable(
  'interventions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    chantierId: uuid('chantier_id')
      .notNull()
      .references(() => chantiers.id, { onDelete: 'cascade' }),
    technicianId: uuid('technician_id')
      .notNull()
      .references(() => technicians.id, { onDelete: 'restrict' }),
    type: interventionTypeEnum('type').notNull().default('reparation'),
    title: text('title'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(60),
    status: interventionStatusEnum('status').notNull().default('planifiee'),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    actualDurationMinutes: integer('actual_duration_minutes'),
    notes: text('notes'),
    report: text('report'),
    geolocationArrival: jsonb('geolocation_arrival'),
    signatureUrl: text('signature_url'),
    clientSatisfaction: integer('client_satisfaction'),
    cancellationReason: text('cancellation_reason'),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('interventions_org_idx').on(t.organizationId),
    chantierIdx: index('interventions_chantier_idx').on(t.chantierId),
    techIdx: index('interventions_tech_idx').on(t.technicianId),
    scheduledIdx: index('interventions_scheduled_idx').on(t.scheduledAt),
    statusIdx: index('interventions_status_idx').on(t.organizationId, t.status),
  }),
)

// ──────────────────────────────────────────────────────────────────
// DOCUMENTS
// ──────────────────────────────────────────────────────────────────

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    chantierId: uuid('chantier_id').references(() => chantiers.id, { onDelete: 'cascade' }),
    interventionId: uuid('intervention_id').references(() => interventions.id, {
      onDelete: 'cascade',
    }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    technicianId: uuid('technician_id').references(() => technicians.id, { onDelete: 'cascade' }),
    type: documentTypeEnum('type').notNull(),
    category: text('category'), // 'avant', 'apres', 'justif', 'admin', etc.
    fileName: text('file_name').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes'),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata'),
  },
  (t) => ({
    orgIdx: index('documents_org_idx').on(t.organizationId),
    chantierIdx: index('documents_chantier_idx').on(t.chantierId),
  }),
)

// ──────────────────────────────────────────────────────────────────
// DEVIS
// ──────────────────────────────────────────────────────────────────

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'restrict' }),
    reference: text('reference').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    chantierId: uuid('chantier_id').references(() => chantiers.id, { onDelete: 'set null' }),
    status: quoteStatusEnum('status').notNull().default('brouillon'),
    issueDate: date('issue_date').notNull().defaultNow(),
    expiryDate: date('expiry_date').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    subject: text('subject').notNull(),
    introText: text('intro_text'),
    paymentTerms: text('payment_terms'),
    conditionsGenerales: text('conditions_generales'),
    cgvVersionSnapshot: text('cgv_version_snapshot'),
    acomptePct: numeric('acompte_pct', { precision: 5, scale: 2 }),
    acompteAmountHt: numeric('acompte_amount_ht', { precision: 12, scale: 2 }),
    totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
    totalTva: numeric('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
    totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),
    totalDiscount: numeric('total_discount', { precision: 12, scale: 2 }).default('0'),
    globalDiscountPct: numeric('global_discount_pct', { precision: 5, scale: 2 }),
    pdfUrl: text('pdf_url'),
    publicToken: text('public_token').notNull().unique(),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    viewedCount: integer('viewed_count').notNull().default(0),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedByName: text('accepted_by_name'),
    acceptedByEmail: text('accepted_by_email'),
    acceptedIp: inet('accepted_ip'),
    acceptedSignatureUrl: text('accepted_signature_url'),
    refusedAt: timestamp('refused_at', { withTimezone: true }),
    refusalReason: text('refusal_reason'),
    lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
    reminderCount: integer('reminder_count').notNull().default(0),
    autoRemindersEnabled: boolean('auto_reminders_enabled').default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('quotes_org_idx').on(t.organizationId),
    agencyIdx: index('quotes_agency_idx').on(t.organizationId, t.agencyId),
    statusIdx: index('quotes_status_idx').on(t.organizationId, t.status),
    clientIdx: index('quotes_client_idx').on(t.clientId),
    refIdx: uniqueIndex('quotes_org_ref_idx').on(t.organizationId, t.reference),
    publicTokenIdx: uniqueIndex('quotes_public_token_idx').on(t.publicToken),
  }),
)

export const quoteLines = pgTable(
  'quote_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    type: text('type').notNull().default('item'), // item | section | subtotal | note
    description: text('description'),
    quantity: numeric('quantity', { precision: 10, scale: 3 }),
    unit: text('unit'),
    unitPriceHt: numeric('unit_price_ht', { precision: 10, scale: 2 }),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }),
    discountPct: numeric('discount_pct', { precision: 5, scale: 2 }),
    totalHt: numeric('total_ht', { precision: 12, scale: 2 }),
  },
  (t) => ({
    quoteIdx: index('quote_lines_quote_idx').on(t.quoteId),
  }),
)

// ──────────────────────────────────────────────────────────────────
// FACTURES
// ──────────────────────────────────────────────────────────────────

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'restrict' }),
    reference: text('reference').notNull(),
    legalSequence: integer('legal_sequence').notNull(),
    legalYear: integer('legal_year').notNull(),
    type: invoiceTypeEnum('type').notNull().default('standard'),
    direction: invoiceDirectionEnum('direction').notNull().default('sale'),
    parentInvoiceId: uuid('parent_invoice_id'),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'restrict' }),
    supplierId: uuid('supplier_id').references(() => suppliers.id, { onDelete: 'restrict' }),
    quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
    chantierId: uuid('chantier_id').references(() => chantiers.id, { onDelete: 'set null' }),
    status: invoiceStatusEnum('status').notNull().default('brouillon'),
    issueDate: date('issue_date').notNull(),
    dueDate: date('due_date').notNull(),
    paidDate: date('paid_date'),
    paymentMethod: text('payment_method'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    subject: text('subject').notNull(),
    introText: text('intro_text'),
    totalHt: numeric('total_ht', { precision: 12, scale: 2 }).notNull().default('0'),
    totalTva: numeric('total_tva', { precision: 12, scale: 2 }).notNull().default('0'),
    totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }).notNull().default('0'),
    paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'),
    latePenaltyApplied: numeric('late_penalty_applied', { precision: 10, scale: 2 }),
    lateIndemnity40: boolean('late_indemnity_40').default(false),
    paymentTerms: text('payment_terms'),
    pdfUrl: text('pdf_url'),
    facturxXml: text('facturx_xml'),
    chorusProId: text('chorus_pro_id'),
    chorusProStatus: text('chorus_pro_status'),
    publicToken: text('public_token').notNull().unique(),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    viewedCount: integer('viewed_count').notNull().default(0),
    notes: text('notes'),
    clientNotes: text('client_notes'),
    metadata: jsonb('metadata'),
    clientSnapshot: jsonb('client_snapshot'), // copie au moment de l'émission (legal)
    organizationSnapshot: jsonb('organization_snapshot'),
    issuedBy: uuid('issued_by').references(() => users.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
    reminderCount: integer('reminder_count').notNull().default(0),
    formalNoticeSentAt: timestamp('formal_notice_sent_at', { withTimezone: true }),
  },
  (t) => ({
    orgIdx: index('invoices_org_idx').on(t.organizationId),
    statusIdx: index('invoices_status_idx').on(t.organizationId, t.status),
    clientIdx: index('invoices_client_idx').on(t.clientId),
    chantierIdx: index('invoices_chantier_idx').on(t.chantierId),
    refIdx: uniqueIndex('invoices_org_ref_idx').on(t.organizationId, t.reference),
    legalSeqIdx: uniqueIndex('invoices_legal_seq_idx').on(
      t.organizationId,
      t.legalYear,
      t.legalSequence,
    ),
    publicTokenIdx: uniqueIndex('invoices_public_token_idx').on(t.publicToken),
    parentFk: foreignKey({
      columns: [t.parentInvoiceId],
      foreignColumns: [t.id],
      name: 'invoices_parent_fk',
    }).onDelete('set null'),
  }),
)

export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    type: text('type').notNull().default('item'),
    description: text('description'),
    quantity: numeric('quantity', { precision: 10, scale: 3 }),
    unit: text('unit'),
    unitPriceHt: numeric('unit_price_ht', { precision: 10, scale: 2 }),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }),
    discountPct: numeric('discount_pct', { precision: 5, scale: 2 }),
    totalHt: numeric('total_ht', { precision: 12, scale: 2 }),
  },
  (t) => ({
    invoiceIdx: index('invoice_lines_invoice_idx').on(t.invoiceId),
  }),
)

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paidAt: date('paid_at').notNull(),
    method: text('method').notNull(),
    reference: text('reference'),
    bankAccount: text('bank_account'),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('payments_org_idx').on(t.organizationId),
    invoiceIdx: index('payments_invoice_idx').on(t.invoiceId),
  }),
)

// ──────────────────────────────────────────────────────────────────
// BONS D'INTERVENTION
// ──────────────────────────────────────────────────────────────────

export const interventionOrders = pgTable(
  'intervention_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'restrict' }),
    reference: text('reference').notNull(),
    chantierId: uuid('chantier_id')
      .notNull()
      .references(() => chantiers.id, { onDelete: 'cascade' }),
    interventionId: uuid('intervention_id').references(() => interventions.id, {
      onDelete: 'set null',
    }),
    technicianId: uuid('technician_id')
      .notNull()
      .references(() => technicians.id, { onDelete: 'restrict' }),
    status: interventionOrderStatusEnum('status').notNull().default('brouillon'),
    interventionDate: date('intervention_date').notNull(),
    arrivalTime: timestamp('arrival_time', { withTimezone: true }),
    departureTime: timestamp('departure_time', { withTimezone: true }),
    actualDurationMinutes: integer('actual_duration_minutes'),
    workDescription: text('work_description'),
    materials: jsonb('materials'),
    additionalNotes: text('additional_notes'),
    clientRemark: text('client_remark'),
    nextAction: text('next_action'),
    requiresRevisit: boolean('requires_revisit').default(false),
    clientSatisfied: boolean('client_satisfied'),
    clientSignatureUrl: text('client_signature_url'),
    clientSignatureName: text('client_signature_name'),
    clientSignatureRole: text('client_signature_role'),
    clientSignatureAt: timestamp('client_signature_at', { withTimezone: true }),
    clientSignatureIp: inet('client_signature_ip'),
    technicianSignatureUrl: text('technician_signature_url'),
    technicianSignatureAt: timestamp('technician_signature_at', { withTimezone: true }),
    refusalReason: text('refusal_reason'),
    refusalExplanation: text('refusal_explanation'),
    pdfUrl: text('pdf_url'),
    pdfHash: text('pdf_hash'),
    totalHt: numeric('total_ht', { precision: 12, scale: 2 }),
    totalTtc: numeric('total_ttc', { precision: 12, scale: 2 }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    publicToken: text('public_token').notNull().unique(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('io_org_idx').on(t.organizationId),
    chantierIdx: index('io_chantier_idx').on(t.chantierId),
    techIdx: index('io_tech_idx').on(t.technicianId),
    statusIdx: index('io_status_idx').on(t.organizationId, t.status),
    refIdx: uniqueIndex('io_org_ref_idx').on(t.organizationId, t.reference),
    publicTokenIdx: uniqueIndex('io_public_token_idx').on(t.publicToken),
  }),
)

export const interventionOrderLines = pgTable(
  'intervention_order_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interventionOrderId: uuid('intervention_order_id')
      .notNull()
      .references(() => interventionOrders.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    type: text('type').notNull(), // material | labor | travel | other
    description: text('description'),
    quantity: numeric('quantity', { precision: 10, scale: 3 }),
    unit: text('unit'),
    unitPriceHt: numeric('unit_price_ht', { precision: 10, scale: 2 }),
    vatRate: numeric('vat_rate', { precision: 5, scale: 2 }),
    totalHt: numeric('total_ht', { precision: 12, scale: 2 }),
  },
  (t) => ({
    ioIdx: index('iol_io_idx').on(t.interventionOrderId),
  }),
)

// ──────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ──────────────────────────────────────────────────────────────────

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    severity: notificationSeverityEnum('severity').notNull().default('info'),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    deliveredChannels: text('delivered_channels').array(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('notifications_user_idx').on(t.userId, t.isRead),
    orgIdx: index('notifications_org_idx').on(t.organizationId),
    createdIdx: index('notifications_created_idx').on(t.userId, t.createdAt),
  }),
)

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    inApp: boolean('in_app').default(true),
    email: boolean('email').default(true),
    push: boolean('push').default(false),
    emailMode: text('email_mode').default('immediate'), // immediate | daily_digest | weekly_digest | disabled
    quietHoursStart: text('quiet_hours_start'), // HH:MM
    quietHoursEnd: text('quiet_hours_end'),
  },
  (t) => ({
    uniqUserOrgEvent: uniqueIndex('notif_prefs_user_org_event_idx').on(
      t.userId,
      t.organizationId,
      t.eventType,
    ),
  }),
)

// ──────────────────────────────────────────────────────────────────
// ACTIVITY LOGS (audit)
// ──────────────────────────────────────────────────────────────────

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    userEmailSnapshot: text('user_email_snapshot'),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    entityReference: text('entity_reference'),
    action: text('action').notNull(),
    changes: jsonb('changes'),
    context: jsonb('context'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('activity_logs_org_idx').on(t.organizationId),
    userIdx: index('activity_logs_user_idx').on(t.userId),
    entityIdx: index('activity_logs_entity_idx').on(t.entityType, t.entityId),
    createdIdx: index('activity_logs_created_idx').on(t.organizationId, t.createdAt),
  }),
)

// ──────────────────────────────────────────────────────────────────
// AI IMPORTS
// ──────────────────────────────────────────────────────────────────

export const aiImports = pgTable(
  'ai_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    sourceType: text('source_type').notNull(), // file | text | voice
    sourceFiles: jsonb('source_files'),
    rawInput: text('raw_input'),
    aiProvider: text('ai_provider'),
    aiModel: text('ai_model'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    costEur: numeric('cost_eur', { precision: 10, scale: 4 }),
    durationMs: integer('duration_ms'),
    resultType: text('result_type'),
    resultPayload: jsonb('result_payload'),
    confidenceScores: jsonb('confidence_scores'),
    userAction: text('user_action'), // accepted | modified | rejected
    userCorrections: jsonb('user_corrections'),
    createdChantierId: uuid('created_chantier_id').references(() => chantiers.id, {
      onDelete: 'set null',
    }),
    createdInvoiceId: uuid('created_invoice_id').references(() => invoices.id, {
      onDelete: 'set null',
    }),
    createdClientId: uuid('created_client_id').references(() => clients.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('ai_imports_org_idx').on(t.organizationId),
    userIdx: index('ai_imports_user_idx').on(t.userId),
    monthIdx: index('ai_imports_month_idx').on(t.organizationId, t.createdAt),
  }),
)

// ──────────────────────────────────────────────────────────────────
// EMAIL & DOCUMENT TEMPLATES
// ──────────────────────────────────────────────────────────────────

export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(), // 'invitation', 'quote_sent', etc.
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    isActive: boolean('is_active').default(true),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqOrgKey: uniqueIndex('email_templates_org_key_idx').on(t.organizationId, t.key),
  }),
)

export const documentTemplates = pgTable(
  'document_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    key: text('key').notNull(), // 'cgv', 'mentions_facture', 'intro_devis', etc.
    version: integer('version').notNull().default(1),
    content: text('content').notNull(),
    isCurrent: boolean('is_current').default(true),
    publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgKeyIdx: index('document_templates_org_key_idx').on(t.organizationId, t.key, t.isCurrent),
  }),
)

// ──────────────────────────────────────────────────────────────────
// SEQUENCE TABLE pour numérotation atomique factures
// ──────────────────────────────────────────────────────────────────

export const invoiceSequences = pgTable(
  'invoice_sequences',
  {
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    legalYear: integer('legal_year').notNull(),
    nextNumber: integer('next_number').notNull().default(1),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.legalYear] }),
  }),
)

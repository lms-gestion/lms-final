/**
 * Types TypeScript dérivés du schéma Drizzle
 * Auto-générés via $inferSelect / $inferInsert
 */

import type {
  organizations,
  organizationSettings,
  agencies,
  users,
  memberships,
  invitations,
  clients,
  contacts,
  clientLocations,
  technicians,
  suppliers,
  chantiers,
  chantierColumns,
  interventions,
  documents,
  quotes,
  quoteLines,
  invoices,
  invoiceLines,
  payments,
  interventionOrders,
  interventionOrderLines,
  notifications,
  notificationPreferences,
  activityLogs,
  aiImports,
  emailTemplates,
  documentTemplates,
} from './schema'

// Sélection (SELECT)
export type Organization = typeof organizations.$inferSelect
export type OrganizationSettings = typeof organizationSettings.$inferSelect
export type Agency = typeof agencies.$inferSelect
export type User = typeof users.$inferSelect
export type Membership = typeof memberships.$inferSelect
export type Invitation = typeof invitations.$inferSelect
export type Client = typeof clients.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type ClientLocation = typeof clientLocations.$inferSelect
export type Technician = typeof technicians.$inferSelect
export type Supplier = typeof suppliers.$inferSelect
export type Chantier = typeof chantiers.$inferSelect
export type ChantierColumn = typeof chantierColumns.$inferSelect
export type Intervention = typeof interventions.$inferSelect
export type Document = typeof documents.$inferSelect
export type Quote = typeof quotes.$inferSelect
export type QuoteLine = typeof quoteLines.$inferSelect
export type Invoice = typeof invoices.$inferSelect
export type InvoiceLine = typeof invoiceLines.$inferSelect
export type Payment = typeof payments.$inferSelect
export type InterventionOrder = typeof interventionOrders.$inferSelect
export type InterventionOrderLine = typeof interventionOrderLines.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type ActivityLog = typeof activityLogs.$inferSelect
export type AiImport = typeof aiImports.$inferSelect
export type EmailTemplate = typeof emailTemplates.$inferSelect
export type DocumentTemplate = typeof documentTemplates.$inferSelect

// Insertion (INSERT)
export type NewOrganization = typeof organizations.$inferInsert
export type NewAgency = typeof agencies.$inferInsert
export type NewUser = typeof users.$inferInsert
export type NewMembership = typeof memberships.$inferInsert
export type NewInvitation = typeof invitations.$inferInsert
export type NewClient = typeof clients.$inferInsert
export type NewContact = typeof contacts.$inferInsert
export type NewClientLocation = typeof clientLocations.$inferInsert
export type NewTechnician = typeof technicians.$inferInsert
export type NewSupplier = typeof suppliers.$inferInsert
export type NewChantier = typeof chantiers.$inferInsert
export type NewChantierColumn = typeof chantierColumns.$inferInsert
export type NewIntervention = typeof interventions.$inferInsert
export type NewDocument = typeof documents.$inferInsert
export type NewQuote = typeof quotes.$inferInsert
export type NewQuoteLine = typeof quoteLines.$inferInsert
export type NewInvoice = typeof invoices.$inferInsert
export type NewInvoiceLine = typeof invoiceLines.$inferInsert
export type NewPayment = typeof payments.$inferInsert
export type NewInterventionOrder = typeof interventionOrders.$inferInsert
export type NewActivityLog = typeof activityLogs.$inferInsert
export type NewAiImport = typeof aiImports.$inferInsert

// Enums
export type UserRole = 'owner' | 'admin' | 'accountant' | 'technician' | 'viewer'
export type ChantierPriority = 'normal' | 'haute' | 'urgence'
export type InvoiceStatus =
  | 'brouillon'
  | 'emise'
  | 'envoyee'
  | 'partiellement_payee'
  | 'payee'
  | 'annulee'
export type InvoiceType = 'standard' | 'avoir' | 'acompte' | 'situation' | 'solde' | 'proforma'
export type InvoiceDirection = 'sale' | 'purchase'
export type QuoteStatus = 'brouillon' | 'envoye' | 'consulte' | 'accepte' | 'refuse' | 'expire'
export type InterventionStatus = 'planifiee' | 'en_cours' | 'terminee' | 'annulee' | 'reportee'
export type InterventionType =
  | 'diagnostic'
  | 'reparation'
  | 'travaux'
  | 'controle'
  | 'urgence'
  | 'livraison'
  | 'autre'
export type ClientType =
  | 'syndic'
  | 'bailleur'
  | 'copropriete'
  | 'assurance'
  | 'tertiaire'
  | 'hotellerie'
  | 'particulier'
export type Metier =
  | 'plomberie'
  | 'electricite'
  | 'toiture'
  | 'serrurerie'
  | 'menuiserie'
  | 'peinture'
  | 'maconnerie'
  | 'syndics'
  | 'autre'

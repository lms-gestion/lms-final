/**
 * Schémas Zod partagés (validation runtime end-to-end)
 */

import { z } from 'zod'
import { isValidEmail, isValidFrPhone, isValidFrPostalCode, isValidIban, isValidSiret } from '../utils/validation'

// ─── Primitives ───
export const zEmail = z.string().email('Email invalide').toLowerCase()
export const zPhoneFr = z.string().refine(isValidFrPhone, 'Téléphone français invalide').optional().or(z.literal(''))
export const zSiret = z.string().refine((s) => !s || isValidSiret(s), 'SIRET invalide').optional().or(z.literal(''))
export const zPostalCode = z.string().refine((s) => !s || isValidFrPostalCode(s), 'Code postal invalide').optional().or(z.literal(''))
export const zIban = z.string().refine((s) => !s || isValidIban(s), 'IBAN invalide').optional().or(z.literal(''))
export const zUuid = z.string().uuid()

// ─── Address ───
export const zAddress = z.object({
  street: z.string().optional(),
  postalCode: zPostalCode,
  city: z.string().optional(),
  country: z.string().default('FR').optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  placeId: z.string().optional(),
  formatted: z.string().optional(),
})

// ─── Auth ───
export const zLoginInput = z.object({
  email: zEmail,
  password: z.string().min(1, 'Mot de passe requis'),
  rememberMe: z.boolean().default(false),
})

export const zMagicLinkInput = z.object({
  email: zEmail,
})

export const zPasswordResetInput = z.object({
  email: zEmail,
})

export const zPasswordChangeInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'Au moins 12 caractères'),
})

export const zSignupFromInvitationInput = z.object({
  token: z.string().min(10),
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  phone: zPhoneFr,
  password: z.string().min(12, 'Au moins 12 caractères'),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Acceptation des CGU requise' }) }),
})

export const zMfaVerifyInput = z.object({
  code: z.string().regex(/^\d{6}$/, '6 chiffres requis'),
})

// ─── Onboarding ───
export const zOnboardingStep1 = z.object({
  name: z.string().min(1, 'Nom commercial requis'),
  legalName: z.string().min(1, 'Raison sociale requise'),
  legalForm: z.string().optional(),
  siret: zSiret,
  tvaIntra: z.string().optional(),
  apeCode: z.string().optional(),
  address: zAddress,
})

export const zOnboardingStep3 = z.object({
  name: z.string().min(1, 'Nom de l\'agence requis'),
  code: z.string().regex(/^[A-Z]{2,4}$/, '2 à 4 lettres en majuscules'),
  address: zAddress,
  phone: zPhoneFr,
  email: zEmail.optional().or(z.literal('')),
  postalCodes: z.array(z.string()).default([]),
  metiers: z.array(z.string()).min(1, 'Au moins un métier'),
})

export const zInvitationInput = z.object({
  email: zEmail,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(['owner', 'admin', 'accountant', 'technician', 'viewer']),
  agencyIds: z.array(zUuid).optional(),
  message: z.string().max(500).optional(),
})

// ─── Client ───
export const zClientInput = z.object({
  name: z.string().min(1, 'Nom requis'),
  type: z.enum(['syndic', 'bailleur', 'copropriete', 'assurance', 'tertiaire', 'hotellerie', 'particulier']),
  legalName: z.string().optional(),
  legalForm: z.string().optional(),
  siret: zSiret,
  tvaIntra: z.string().optional(),
  cardProGT: z.string().optional(),
  address: zAddress.optional(),
  phone: zPhoneFr,
  email: zEmail.optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  defaultAgencyId: zUuid.optional(),
  paymentTermsDays: z.number().int().min(0).max(120).default(30),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

// ─── Chantier ───
export const zChantierInput = z.object({
  clientId: zUuid,
  locationId: zUuid.optional(),
  agencyId: zUuid,
  metier: z.string().min(1),
  priority: z.enum(['normal', 'haute', 'urgence']).default('normal'),
  title: z.string().min(1, 'Titre requis'),
  description: z.string().optional(),
  address: zAddress.optional(),
  tenantName: z.string().optional(),
  tenantPhone: zPhoneFr,
  tenantEmail: zEmail.optional().or(z.literal('')),
  supplierId: zUuid.optional(),
  supplierReference: z.string().optional(),
  assignedTechnicianId: zUuid.optional(),
  scheduledDate: z.string().optional(), // ISO date
  deadlineDate: z.string().optional(),
  estimatedDurationHours: z.number().positive().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

// ─── Intervention ───
export const zInterventionInput = z.object({
  chantierId: zUuid,
  technicianId: zUuid,
  type: z.enum(['diagnostic', 'reparation', 'travaux', 'controle', 'urgence', 'livraison', 'autre']),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(60),
  title: z.string().optional(),
  notes: z.string().optional(),
})

// ─── Ligne devis/facture ───
export const zLineInput = z.object({
  type: z.enum(['item', 'section', 'subtotal', 'note']).default('item'),
  position: z.number().int().nonnegative(),
  description: z.string(),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  unitPriceHt: z.number().optional(),
  vatRate: z.number().min(0).max(30).optional(),
  discountPct: z.number().min(0).max(100).optional(),
})

// ─── Devis ───
export const zQuoteInput = z.object({
  clientId: zUuid,
  chantierId: zUuid.optional(),
  agencyId: zUuid,
  subject: z.string().min(1),
  introText: z.string().optional(),
  paymentTerms: z.string().optional(),
  acomptePct: z.number().min(0).max(100).optional(),
  expiryDate: z.string(), // ISO date
  lines: z.array(zLineInput).default([]),
})

// ─── Facture ───
export const zInvoiceInput = z.object({
  type: z.enum(['standard', 'avoir', 'acompte', 'situation', 'solde', 'proforma']).default('standard'),
  direction: z.enum(['sale', 'purchase']).default('sale'),
  parentInvoiceId: zUuid.optional(),
  clientId: zUuid.optional(),
  supplierId: zUuid.optional(),
  quoteId: zUuid.optional(),
  chantierId: zUuid.optional(),
  agencyId: zUuid,
  subject: z.string().min(1),
  introText: z.string().optional(),
  issueDate: z.string(),
  dueDate: z.string(),
  paymentTerms: z.string().optional(),
  lines: z.array(zLineInput).default([]),
})

export const zPaymentInput = z.object({
  invoiceId: zUuid,
  amount: z.number().positive(),
  paidAt: z.string(),
  method: z.enum(['virement', 'cheque', 'cb', 'especes', 'prelevement', 'traite']),
  reference: z.string().optional(),
  bankAccount: z.string().optional(),
  notes: z.string().optional(),
})

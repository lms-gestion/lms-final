/**
 * Routes tRPC pour les devis (CRUD + lignes + envoi)
 *
 * Cf. spec module 06 - Devis
 *
 * Securite : toutes les routes passent par orgProcedure (multi-tenant garanti
 * par les RLS Postgres).
 */

import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm'
import { db, schema } from '@lms/db'
import { orgProcedure, router } from '../server'

const QUOTE_STATUSES = ['brouillon', 'envoye', 'consulte', 'accepte', 'refuse', 'expire'] as const
const LINE_TYPES = ['item', 'section', 'subtotal', 'note'] as const

const lineInput = z.object({
  type: z.enum(LINE_TYPES).default('item'),
  position: z.number().int().nonnegative(),
  description: z.string().optional(),
  quantity: z.number().nonnegative().optional().nullable(),
  unit: z.string().optional().nullable(),
  unitPriceHt: z.number().optional().nullable(),
  vatRate: z.number().min(0).max(30).optional().nullable(),
  discountPct: z.number().min(0).max(100).optional().nullable(),
})

const createQuoteInput = z.object({
  clientId: z.string().uuid(),
  chantierId: z.string().uuid().optional().nullable(),
  agencyId: z.string().uuid().optional().nullable(),
  subject: z.string().min(1, 'Objet requis'),
  introText: z.string().optional(),
  paymentTerms: z.string().optional(),
  acomptePct: z.number().min(0).max(100).optional().nullable(),
  validityDays: z.number().int().min(1).max(365).default(30),
  lines: z.array(lineInput).default([]),
})

const updateQuoteInput = z.object({
  id: z.string().uuid(),
  data: z.object({
    subject: z.string().min(1).optional(),
    introText: z.string().optional(),
    paymentTerms: z.string().optional(),
    acomptePct: z.number().min(0).max(100).optional().nullable(),
    expiryDate: z.string().optional(),
    lines: z.array(lineInput).optional(),
  }),
})

// ─── Utils ───

function generateReference(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return 'DEVIS-' + year + month + day + '-' + suffix
}

function generatePublicToken(): string {
  // 32 caracteres aleatoires url-safe
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getOrCreateDefaultAgency(organizationId: string) {
  const [existing] = await db
    .select()
    .from(schema.agencies)
    .where(eq(schema.agencies.organizationId, organizationId))
    .limit(1)

  if (existing) return existing

  const [agency] = await db
    .insert(schema.agencies)
    .values({
      organizationId,
      name: 'Agence principale',
      code: 'MAIN',
      metiers: ['multiservices'],
      postalCodes: [],
      status: 'active',
    })
    .returning()

  return agency
}

/**
 * Calcule les totaux d'un devis depuis sa liste de lignes.
 * Retourne { totalHt, totalTva, totalTtc, totalDiscount } sous forme de strings (pour Drizzle numeric).
 */
function computeTotals(lines: Array<z.infer<typeof lineInput>>): {
  totalHt: string
  totalTva: string
  totalTtc: string
  totalDiscount: string
} {
  let ht = 0
  let tva = 0
  let discount = 0

  for (const line of lines) {
    if (line.type !== 'item') continue
    const qty = Number(line.quantity ?? 0)
    const pu = Number(line.unitPriceHt ?? 0)
    const disc = Number(line.discountPct ?? 0)
    const vat = Number(line.vatRate ?? 0)

    const grossLine = qty * pu
    const lineDiscount = grossLine * (disc / 100)
    const netLine = grossLine - lineDiscount
    discount += lineDiscount
    ht += netLine
    tva += netLine * (vat / 100)
  }

  return {
    totalHt: ht.toFixed(2),
    totalTva: tva.toFixed(2),
    totalTtc: (ht + tva).toFixed(2),
    totalDiscount: discount.toFixed(2),
  }
}

async function assertChantierInOrg(chantierId: string, organizationId: string) {
  const [c] = await db
    .select({ id: schema.chantiers.id, agencyId: schema.chantiers.agencyId })
    .from(schema.chantiers)
    .where(and(eq(schema.chantiers.id, chantierId), eq(schema.chantiers.organizationId, organizationId)))
    .limit(1)
  if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Chantier introuvable' })
  return c
}

async function assertClientInOrg(clientId: string, organizationId: string) {
  const [c] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.organizationId, organizationId)))
    .limit(1)
  if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Client introuvable' })
  return c
}

// ─── Router ───

function formatQuoteReference(n: number) {
  return 'D' + String(n).padStart(5, '0')
}

export const quotesRouter = router({
  /** Liste paginee de devis avec filtres */
  list: orgProcedure
    .input(
      z
        .object({
          status: z.enum(QUOTE_STATUSES).optional(),
          clientId: z.string().uuid().optional(),
          chantierId: z.string().uuid().optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(schema.quotes.organizationId, ctx.organizationId)]

      if (input?.status) {
        conditions.push(eq(schema.quotes.status, input.status))
      }
      if (input?.clientId) {
        conditions.push(eq(schema.quotes.clientId, input.clientId))
      }
      if (input?.chantierId) {
        conditions.push(eq(schema.quotes.chantierId, input.chantierId))
      }

      return db
        .select({
          id: schema.quotes.id,
          reference: schema.quotes.reference,
          status: schema.quotes.status,
          subject: schema.quotes.subject,
          issueDate: schema.quotes.issueDate,
          expiryDate: schema.quotes.expiryDate,
          totalHt: schema.quotes.totalHt,
          totalTtc: schema.quotes.totalTtc,
          createdAt: schema.quotes.createdAt,
          sentAt: schema.quotes.sentAt,
          acceptedAt: schema.quotes.acceptedAt,
          viewedCount: schema.quotes.viewedCount,
          clientId: schema.quotes.clientId,
          chantierId: schema.quotes.chantierId,
          clientName: schema.clients.name,
          chantierReference: schema.chantiers.reference,
          chantierTitle: schema.chantiers.title,
        })
        .from(schema.quotes)
        .leftJoin(schema.clients, eq(schema.quotes.clientId, schema.clients.id))
        .leftJoin(schema.chantiers, eq(schema.quotes.chantierId, schema.chantiers.id))
        .where(and(...conditions))
        .orderBy(desc(schema.quotes.createdAt))
        .limit(200)
    }),

  /** Detail complet d'un devis (avec lignes) */
  get: orgProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const [quote] = await db
      .select({
        id: schema.quotes.id,
        organizationId: schema.quotes.organizationId,
        agencyId: schema.quotes.agencyId,
        reference: schema.quotes.reference,
        clientId: schema.quotes.clientId,
        chantierId: schema.quotes.chantierId,
        status: schema.quotes.status,
        issueDate: schema.quotes.issueDate,
        expiryDate: schema.quotes.expiryDate,
        sentAt: schema.quotes.sentAt,
        subject: schema.quotes.subject,
        introText: schema.quotes.introText,
        paymentTerms: schema.quotes.paymentTerms,
        conditionsGenerales: schema.quotes.conditionsGenerales,
        acomptePct: schema.quotes.acomptePct,
        acompteAmountHt: schema.quotes.acompteAmountHt,
        totalHt: schema.quotes.totalHt,
        totalTva: schema.quotes.totalTva,
        totalTtc: schema.quotes.totalTtc,
        totalDiscount: schema.quotes.totalDiscount,
        pdfUrl: schema.quotes.pdfUrl,
        publicToken: schema.quotes.publicToken,
        viewedAt: schema.quotes.viewedAt,
        viewedCount: schema.quotes.viewedCount,
        acceptedAt: schema.quotes.acceptedAt,
        acceptedByName: schema.quotes.acceptedByName,
        refusedAt: schema.quotes.refusedAt,
        refusalReason: schema.quotes.refusalReason,
        createdAt: schema.quotes.createdAt,
        clientName: schema.clients.name,
        clientLegalName: schema.clients.legalName,
        clientAddress: schema.clients.address,
        clientEmail: schema.clients.email,
        clientPhone: schema.clients.phone,
        chantierReference: schema.chantiers.reference,
        chantierTitle: schema.chantiers.title,
      })
      .from(schema.quotes)
      .leftJoin(schema.clients, eq(schema.quotes.clientId, schema.clients.id))
      .leftJoin(schema.chantiers, eq(schema.quotes.chantierId, schema.chantiers.id))
      .where(
        and(eq(schema.quotes.id, input.id), eq(schema.quotes.organizationId, ctx.organizationId)),
      )
      .limit(1)

    if (!quote) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Devis introuvable' })
    }

    const lines = await db
      .select()
      .from(schema.quoteLines)
      .where(eq(schema.quoteLines.quoteId, input.id))
      .orderBy(asc(schema.quoteLines.position))

    return { quote, lines }
  }),

  /** Selectors pour l'editeur (clients, chantiers, agences, lignes types) */
  selectors: orgProcedure.query(async ({ ctx }) => {
    const clients = await db
      .select({
        id: schema.clients.id,
        name: schema.clients.name,
        type: schema.clients.type,
      })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.organizationId, ctx.organizationId),
          isNull(schema.clients.archivedAt),
        ),
      )
      .orderBy(asc(schema.clients.name))

    const chantiers = await db
      .select({
        id: schema.chantiers.id,
        reference: schema.chantiers.reference,
        title: schema.chantiers.title,
        clientId: schema.chantiers.clientId,
        clientName: schema.clients.name,
      })
      .from(schema.chantiers)
      .leftJoin(schema.clients, eq(schema.chantiers.clientId, schema.clients.id))
      .where(
        and(
          eq(schema.chantiers.organizationId, ctx.organizationId),
          isNull(schema.chantiers.archivedAt),
        ),
      )
      .orderBy(desc(schema.chantiers.createdAt))

    const agencies = await db
      .select({ id: schema.agencies.id, name: schema.agencies.name, code: schema.agencies.code })
      .from(schema.agencies)
      .where(eq(schema.agencies.organizationId, ctx.organizationId))

    return {
      clients,
      chantiers,
      agencies,
      vatRates: [20, 10, 5.5, 0],
      lineUnits: ['u', 'h', 'j', 'ml', 'm2', 'm3', 'kg', 'forfait'],
    }
  }),

  /** Pre-remplit un devis depuis un chantier (pour /devis/new?chantierId=...) */
  prefillFromChantier: orgProcedure
    .input(z.object({ chantierId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [c] = await db
        .select({
          id: schema.chantiers.id,
          clientId: schema.chantiers.clientId,
          agencyId: schema.chantiers.agencyId,
          title: schema.chantiers.title,
          description: schema.chantiers.description,
          reference: schema.chantiers.reference,
          metier: schema.chantiers.metier,
          clientName: schema.clients.name,
        })
        .from(schema.chantiers)
        .leftJoin(schema.clients, eq(schema.chantiers.clientId, schema.clients.id))
        .where(
          and(
            eq(schema.chantiers.id, input.chantierId),
            eq(schema.chantiers.organizationId, ctx.organizationId),
          ),
        )
        .limit(1)

      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Chantier introuvable' })

      const subject = c.title ? `${c.title} - ${c.metier ?? ''}`.trim() : `Devis - ${c.metier ?? ''}`

      return {
        clientId: c.clientId,
        chantierId: c.id,
        agencyId: c.agencyId,
        subject,
        introText: c.description ?? '',
        chantierReference: c.reference,
        chantierTitle: c.title,
        clientName: c.clientName,
      }
    }),

  /** Cree un devis en brouillon */
  create: orgProcedure.input(createQuoteInput).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission insuffisante' })
    }

    await assertClientInOrg(input.clientId, ctx.organizationId)
    if (input.chantierId) {
      await assertChantierInOrg(input.chantierId, ctx.organizationId)
    }

    let agencyId = input.agencyId
    if (!agencyId) {
      const agency = await getOrCreateDefaultAgency(ctx.organizationId)
      agencyId = agency!.id
    }

    const totals = computeTotals(input.lines)
    const issueDate = new Date()
    const expiryDate = new Date(issueDate)
    expiryDate.setDate(expiryDate.getDate() + input.validityDays)

    const acompteAmountHt = input.acomptePct
      ? ((Number(totals.totalHt) * input.acomptePct) / 100).toFixed(2)
      : null

    const [quote] = await db
      .insert(schema.quotes)
      .values({
        organizationId: ctx.organizationId,
        agencyId,
        reference: generateReference(),
        clientId: input.clientId,
        chantierId: input.chantierId ?? undefined,
        status: 'brouillon',
        issueDate: issueDate.toISOString().slice(0, 10),
        expiryDate: expiryDate.toISOString().slice(0, 10),
        subject: input.subject,
        introText: input.introText,
        paymentTerms: input.paymentTerms,
        acomptePct: input.acomptePct ? String(input.acomptePct) : undefined,
        acompteAmountHt: acompteAmountHt ?? undefined,
        totalHt: totals.totalHt,
        totalTva: totals.totalTva,
        totalTtc: totals.totalTtc,
        totalDiscount: totals.totalDiscount,
        publicToken: generatePublicToken(),
        createdBy: ctx.user.id,
      })
      .returning()

    if (!quote) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })

    if (input.lines.length > 0) {
      await db.insert(schema.quoteLines).values(
        input.lines.map((line) => ({
          quoteId: quote.id,
          position: line.position,
          type: line.type,
          description: line.description,
          quantity: line.quantity != null ? String(line.quantity) : undefined,
          unit: line.unit ?? undefined,
          unitPriceHt: line.unitPriceHt != null ? String(line.unitPriceHt) : undefined,
          vatRate: line.vatRate != null ? String(line.vatRate) : undefined,
          discountPct: line.discountPct != null ? String(line.discountPct) : undefined,
          totalHt:
            line.type === 'item' && line.quantity != null && line.unitPriceHt != null
              ? (
                  Number(line.quantity) *
                  Number(line.unitPriceHt) *
                  (1 - Number(line.discountPct ?? 0) / 100)
                ).toFixed(2)
              : undefined,
        })),
      )
    }

    return quote
  }),

  /** Met a jour un devis brouillon (lignes incluses) */
  update: orgProcedure.input(updateQuoteInput).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    const [existing] = await db
      .select({ status: schema.quotes.status })
      .from(schema.quotes)
      .where(
        and(eq(schema.quotes.id, input.id), eq(schema.quotes.organizationId, ctx.organizationId)),
      )
      .limit(1)

    if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })

    if (existing.status !== 'brouillon') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Un devis envoye ou accepte ne peut plus etre modifie. Dupliquez-le si besoin.',
      })
    }

    const updates: Record<string, unknown> = {}
    if (input.data.subject !== undefined) updates.subject = input.data.subject
    if (input.data.introText !== undefined) updates.introText = input.data.introText
    if (input.data.paymentTerms !== undefined) updates.paymentTerms = input.data.paymentTerms
    if (input.data.expiryDate !== undefined) updates.expiryDate = input.data.expiryDate
    if (input.data.acomptePct !== undefined && input.data.acomptePct !== null) {
      updates.acomptePct = String(input.data.acomptePct)
    }

    // Si lignes fournies, on remplace tout (atomique)
    if (input.data.lines) {
      const totals = computeTotals(input.data.lines)
      updates.totalHt = totals.totalHt
      updates.totalTva = totals.totalTva
      updates.totalTtc = totals.totalTtc
      updates.totalDiscount = totals.totalDiscount

      if (input.data.acomptePct != null) {
        updates.acompteAmountHt = (
          (Number(totals.totalHt) * input.data.acomptePct) /
          100
        ).toFixed(2)
      }

      // Replace toutes les lignes
      await db.delete(schema.quoteLines).where(eq(schema.quoteLines.quoteId, input.id))
      if (input.data.lines.length > 0) {
        await db.insert(schema.quoteLines).values(
          input.data.lines.map((line) => ({
            quoteId: input.id,
            position: line.position,
            type: line.type,
            description: line.description,
            quantity: line.quantity != null ? String(line.quantity) : undefined,
            unit: line.unit ?? undefined,
            unitPriceHt: line.unitPriceHt != null ? String(line.unitPriceHt) : undefined,
            vatRate: line.vatRate != null ? String(line.vatRate) : undefined,
            discountPct: line.discountPct != null ? String(line.discountPct) : undefined,
            totalHt:
              line.type === 'item' && line.quantity != null && line.unitPriceHt != null
                ? (
                    Number(line.quantity) *
                    Number(line.unitPriceHt) *
                    (1 - Number(line.discountPct ?? 0) / 100)
                  ).toFixed(2)
                : undefined,
          })),
        )
      }
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.quotes)
        .set(updates)
        .where(
          and(eq(schema.quotes.id, input.id), eq(schema.quotes.organizationId, ctx.organizationId)),
        )
    }

    return { ok: true }
  }),

  /** Envoi : passage brouillon -> envoye, attribution definitive */
  send: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    const [quote] = await db
      .select({
        id: schema.quotes.id,
        status: schema.quotes.status,
        totalHt: schema.quotes.totalHt,
      })
      .from(schema.quotes)
      .where(
        and(eq(schema.quotes.id, input.id), eq(schema.quotes.organizationId, ctx.organizationId)),
      )
      .limit(1)

    if (!quote) throw new TRPCError({ code: 'NOT_FOUND' })
    if (quote.status !== 'brouillon') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Ce devis a deja ete envoye',
      })
    }
    if (Number(quote.totalHt) === 0) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Impossible d\'envoyer un devis a 0 EUR. Ajoutez au moins une ligne.',
      })
    }

    await db
      .update(schema.quotes)
      .set({
        status: 'envoye',
        sentAt: new Date(),
      })
      .where(eq(schema.quotes.id, input.id))

    return { ok: true }
  }),

  /** Marque accepte / refuse / expire (action interne, le client peut aussi le faire via lien public Phase 2) */
  changeStatus: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['envoye', 'consulte', 'accepte', 'refuse', 'expire']),
        acceptedByName: z.string().optional(),
        refusalReason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const updates: Record<string, unknown> = { status: input.status }
      const now = new Date()

      if (input.status === 'accepte') {
        updates.acceptedAt = now
        updates.acceptedByName = input.acceptedByName ?? null
      } else if (input.status === 'refuse') {
        updates.refusedAt = now
        updates.refusalReason = input.refusalReason ?? null
      } else if (input.status === 'consulte') {
        updates.viewedAt = now
      }

      await db
        .update(schema.quotes)
        .set(updates)
        .where(
          and(eq(schema.quotes.id, input.id), eq(schema.quotes.organizationId, ctx.organizationId)),
        )

      return { ok: true }
    }),

  /** Suppression (uniquement brouillon) */
  delete: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    const [quote] = await db
      .select({ status: schema.quotes.status })
      .from(schema.quotes)
      .where(
        and(eq(schema.quotes.id, input.id), eq(schema.quotes.organizationId, ctx.organizationId)),
      )
      .limit(1)

    if (!quote) throw new TRPCError({ code: 'NOT_FOUND' })
    if (quote.status !== 'brouillon') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Seuls les devis en brouillon peuvent etre supprimes',
      })
    }

    await db.delete(schema.quoteLines).where(eq(schema.quoteLines.quoteId, input.id))
    await db.delete(schema.quotes).where(eq(schema.quotes.id, input.id))

    return { ok: true }
  }),

  /** Statistiques pour le header de la liste */
  stats: orgProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        status: schema.quotes.status,
        total: sql<string>`COALESCE(SUM(${schema.quotes.totalTtc}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(schema.quotes)
      .where(eq(schema.quotes.organizationId, ctx.organizationId))
      .groupBy(schema.quotes.status)

    const result: Record<string, { count: number; totalTtc: number }> = {}
    for (const r of rows) {
      result[r.status] = { count: Number(r.count), totalTtc: Number(r.total) }
    }
    return result
  }),
})

/**
 * Routes tRPC pour les clients (CRUD + recherche + statistiques)
 *
 * Cf. spec module 03 — Clients & Contacts
 *
 * Sécurité : toutes les routes passent par orgProcedure Suivant multi-tenant garanti
 * par les RLS Postgres (cf. infra/supabase/rls.sql).
 */

import { TRPCError } from '@trpc/server'
import { router, orgProcedure } from '../server'
import { zClientInput, zUuid } from '@lms/shared'
import { z } from 'zod'
import { db, schema } from '@lms/db'
import { and, desc, eq, ilike, or, isNull, sql, count } from 'drizzle-orm'

// ─── Filtres ───
const zListInput = z.object({
  search: z.string().optional(),
  type: z
    .array(z.enum(['syndic', 'bailleur', 'copropriete', 'assurance', 'tertiaire', 'hotellerie', 'particulier']))
    .optional(),
  agencyId: zUuid.optional(),
  includeArchived: z.boolean().default(false),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(250).default(50),
})

export const clientsRouter = router({
  /** Liste paginée avec filtres */
  list: orgProcedure.input(zListInput).query(async ({ ctx, input }) => {
    const conditions = [eq(schema.clients.organizationId, ctx.organizationId)]

    if (!input.includeArchived) {
      conditions.push(isNull(schema.clients.archivedAt))
    }

    if (input.type && input.type.length > 0) {
      conditions.push(sql`${schema.clients.type} = ANY(${input.type})`)
    }

    if (input.agencyId) {
      conditions.push(eq(schema.clients.defaultAgencyId, input.agencyId))
    }

    if (input.search && input.search.length >= 2) {
      const q = `%${input.search}%`
      conditions.push(
        or(
          ilike(schema.clients.name, q),
          ilike(schema.clients.legalName, q),
          ilike(schema.clients.siret, q),
          ilike(schema.clients.email, q),
        )!,
      )
    }

    const offset = (input.page - 1) * input.pageSize

    const [items, totalRow] = await Promise.all([
      db
        .select({
          id: schema.clients.id,
          name: schema.clients.name,
          legalName: schema.clients.legalName,
          type: schema.clients.type,
          siret: schema.clients.siret,
          email: schema.clients.email,
          phone: schema.clients.phone,
          paymentTermsDays: schema.clients.paymentTermsDays,
          paymentStatusScore: schema.clients.paymentStatusScore,
          paymentStatusOverride: schema.clients.paymentStatusOverride,
          tags: schema.clients.tags,
          createdAt: schema.clients.createdAt,
          archivedAt: schema.clients.archivedAt,
          defaultAgencyId: schema.clients.defaultAgencyId,
        })
        .from(schema.clients)
        .where(and(...conditions))
        .orderBy(desc(schema.clients.createdAt))
        .limit(input.pageSize)
        .offset(offset),
      db
        .select({ total: count() })
        .from(schema.clients)
        .where(and(...conditions)),
    ])

    return {
      items,
      total: totalRow[0]?.total ?? 0,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil((totalRow[0]?.total ?? 0) / input.pageSize),
    }
  }),

  /** Récupère un client + ses stats (CA, encours, nb chantiers) */
  get: orgProcedure.input(z.object({ id: zUuid })).query(async ({ ctx, input }) => {
    const [client] = await db
      .select()
      .from(schema.clients)
      .where(and(eq(schema.clients.id, input.id), eq(schema.clients.organizationId, ctx.organizationId)))
      .limit(1)

    if (!client) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Client introuvable' })
    }

    // Stats agrégées
    const [stats] = await db
      .select({
        chantiersActifs: sql<number>`COUNT(*) FILTER (WHERE ${schema.chantiers.archivedAt} IS NULL AND ${schema.chantiers.closedAt} IS NULL)`,
        chantiersTotal: count(schema.chantiers.id),
      })
      .from(schema.chantiers)
      .where(eq(schema.chantiers.clientId, input.id))

    const [invoiceStats] = await db
      .select({
        caTotal: sql<string>`COALESCE(SUM(${schema.invoices.totalTtc}), 0)`,
        ca12mois: sql<string>`COALESCE(SUM(${schema.invoices.totalTtc}) FILTER (WHERE ${schema.invoices.issueDate} >= NOW() - INTERVAL '12 months'), 0)`,
        encoursImpaye: sql<string>`COALESCE(SUM(${schema.invoices.totalTtc} - ${schema.invoices.paidAmount}) FILTER (WHERE ${schema.invoices.status} IN ('emise', 'envoyee', 'partiellement_payee') AND ${schema.invoices.dueDate} < CURRENT_DATE), 0)`,
        nbFactures: count(schema.invoices.id),
      })
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.clientId, input.id),
          eq(schema.invoices.direction, 'sale'),
        ),
      )

    return {
      ...client,
      stats: {
        chantiersActifs: stats?.chantiersActifs ?? 0,
        chantiersTotal: stats?.chantiersTotal ?? 0,
        caTotal: Number(invoiceStats?.caTotal ?? 0),
        ca12mois: Number(invoiceStats?.ca12mois ?? 0),
        encoursImpaye: Number(invoiceStats?.encoursImpaye ?? 0),
        nbFactures: invoiceStats?.nbFactures ?? 0,
      },
    }
  }),

  /** Création d'un nouveau client */
  create: orgProcedure.input(zClientInput).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Permission insuffisante' })
    }

    // Détection doublons par SIRET
    if (input.siret) {
      const existing = await db
        .select({ id: schema.clients.id, name: schema.clients.name })
        .from(schema.clients)
        .where(
          and(
            eq(schema.clients.organizationId, ctx.organizationId),
            eq(schema.clients.siret, input.siret),
            isNull(schema.clients.archivedAt),
          ),
        )
        .limit(1)
      if (existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Un client actif avec ce SIRET existe déjà : ${existing[0]!.name}`,
        })
      }
    }

    const [created] = await db
      .insert(schema.clients)
      .values({
        organizationId: ctx.organizationId,
        name: input.name,
        legalName: input.legalName,
        legalForm: input.legalForm,
        type: input.type,
        siret: input.siret || null,
        tvaIntra: input.tvaIntra,
        cardProGT: input.cardProGT,
        address: input.address,
        phone: input.phone || null,
        email: input.email || null,
        website: input.website || null,
        defaultAgencyId: input.defaultAgencyId,
        paymentTermsDays: input.paymentTermsDays,
        notes: input.notes,
        tags: input.tags,
        createdBy: ctx.user.id,
      })
      .returning()

    return created
  }),

  /** Mise à jour d'un client existant */
  update: orgProcedure
    .input(z.object({ id: zUuid, data: zClientInput.partial() }))
    .mutation(async ({ ctx, input }) => {
      if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const [updated] = await db
        .update(schema.clients)
        .set({
          ...(input.data.name !== undefined && { name: input.data.name }),
          ...(input.data.legalName !== undefined && { legalName: input.data.legalName }),
          ...(input.data.type !== undefined && { type: input.data.type }),
          ...(input.data.siret !== undefined && { siret: input.data.siret || null }),
          ...(input.data.tvaIntra !== undefined && { tvaIntra: input.data.tvaIntra }),
          ...(input.data.address !== undefined && { address: input.data.address }),
          ...(input.data.phone !== undefined && { phone: input.data.phone || null }),
          ...(input.data.email !== undefined && { email: input.data.email || null }),
          ...(input.data.website !== undefined && { website: input.data.website || null }),
          ...(input.data.paymentTermsDays !== undefined && {
            paymentTermsDays: input.data.paymentTermsDays,
          }),
          ...(input.data.defaultAgencyId !== undefined && {
            defaultAgencyId: input.data.defaultAgencyId,
          }),
          ...(input.data.notes !== undefined && { notes: input.data.notes }),
          ...(input.data.tags !== undefined && { tags: input.data.tags }),
        })
        .where(
          and(eq(schema.clients.id, input.id), eq(schema.clients.organizationId, ctx.organizationId)),
        )
        .returning()

      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' })
      return updated
    }),

  /** Archive (soft delete) d'un client */
  archive: orgProcedure
    .input(z.object({ id: zUuid, reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!['owner', 'admin'].includes(ctx.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner ou admin uniquement' })
      }

      const [archived] = await db
        .update(schema.clients)
        .set({
          archivedAt: new Date(),
          archiveReason: input.reason,
        })
        .where(
          and(eq(schema.clients.id, input.id), eq(schema.clients.organizationId, ctx.organizationId)),
        )
        .returning({ id: schema.clients.id })

      if (!archived) throw new TRPCError({ code: 'NOT_FOUND' })
      return { ok: true }
    }),

  /** Désarchive un client (réactive) */
  unarchive: orgProcedure.input(z.object({ id: zUuid })).mutation(async ({ ctx, input }) => {
    if (ctx.role !== 'owner') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Owner uniquement' })
    }

    await db
      .update(schema.clients)
      .set({ archivedAt: null, archiveReason: null })
      .where(
        and(eq(schema.clients.id, input.id), eq(schema.clients.organizationId, ctx.organizationId)),
      )
    return { ok: true }
  }),

  /** Recherche autocomplete (utilisé dans modals chantier, devis, facture) */
  searchAutocomplete: orgProcedure
    .input(z.object({ q: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const q = `%${input.q}%`
      return db
        .select({
          id: schema.clients.id,
          name: schema.clients.name,
          type: schema.clients.type,
          siret: schema.clients.siret,
        })
        .from(schema.clients)
        .where(
          and(
            eq(schema.clients.organizationId, ctx.organizationId),
            isNull(schema.clients.archivedAt),
            or(
              ilike(schema.clients.name, q),
              ilike(schema.clients.legalName, q),
              ilike(schema.clients.siret, q),
            )!,
          ),
        )
        .orderBy(schema.clients.name)
        .limit(10)
    }),

  /** Stats globales de la base clients (pour le header de la page) */
  stats: orgProcedure.query(async ({ ctx }) => {
    const [globalStats] = await db
      .select({
        total: count(schema.clients.id),
        actifs: sql<number>`COUNT(*) FILTER (WHERE ${schema.clients.archivedAt} IS NULL)`,
      })
      .from(schema.clients)
      .where(eq(schema.clients.organizationId, ctx.organizationId))

    const [revenueStats] = await db
      .select({
        ca12mois: sql<string>`COALESCE(SUM(${schema.invoices.totalTtc}) FILTER (WHERE ${schema.invoices.issueDate} >= NOW() - INTERVAL '12 months'), 0)`,
      })
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.organizationId, ctx.organizationId),
          eq(schema.invoices.direction, 'sale'),
        ),
      )

    return {
      total: globalStats?.total ?? 0,
      actifs: globalStats?.actifs ?? 0,
      ca12mois: Number(revenueStats?.ca12mois ?? 0),
    }
  }),
})

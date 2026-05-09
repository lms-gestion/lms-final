import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@lms/db'
import { orgProcedure, router } from '../server'

const supplierTypes = [
  'donneur_ordre',
  'materiel',
  'sous_traitant',
  'autre',
] as const

const supplierInput = z.object({
  name: z.string().min(1, 'Nom requis'),
  type: z.enum(supplierTypes).default('autre'),
  legalName: z.string().optional(),
  siret: z.string().optional(),
  tvaIntra: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  primaryContactName: z.string().optional(),
  primaryContactRole: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal('')),
  primaryContactPhone: z.string().optional(),
  paymentTermsDays: z.number().int().min(0).default(30),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

export const suppliersRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(schema.suppliers)
      .where(
        and(
          eq(schema.suppliers.organizationId, ctx.organizationId),
          isNull(schema.suppliers.archivedAt),
        ),
      )
      .orderBy(desc(schema.suppliers.createdAt))
  }),

  create: orgProcedure.input(supplierInput).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Droits insuffisants',
      })
    }

    const [supplier] = await db
      .insert(schema.suppliers)
      .values({
        organizationId: ctx.organizationId,
        name: input.name,
        type: input.type,
        legalName: input.legalName || undefined,
        siret: input.siret || undefined,
        tvaIntra: input.tvaIntra || undefined,
        phone: input.phone || undefined,
        email: input.email || undefined,
        website: input.website || undefined,
        primaryContactName: input.primaryContactName || undefined,
        primaryContactRole: input.primaryContactRole || undefined,
        primaryContactEmail: input.primaryContactEmail || undefined,
        primaryContactPhone: input.primaryContactPhone || undefined,
        paymentTermsDays: input.paymentTermsDays,
        paymentMethod: input.paymentMethod || undefined,
        notes: input.notes || undefined,
        tags: input.tags,
      })
      .returning()

    return supplier
  }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: supplierInput.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const [supplier] = await db
        .update(schema.suppliers)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.suppliers.id, input.id),
            eq(schema.suppliers.organizationId, ctx.organizationId),
          ),
        )
        .returning()

      return supplier
    }),

  archive: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin', 'accountant'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    await db
      .update(schema.suppliers)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.suppliers.id, input.id),
          eq(schema.suppliers.organizationId, ctx.organizationId),
        ),
      )

    return { ok: true }
  }),
})

import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@lms/db'
import { orgProcedure, router } from '../server'

const zAddress = z.object({
  street: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  placeId: z.string().optional(),
}).optional()

const zLocationInput = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1, 'Nom du lieu requis'),
  internalCode: z.string().optional(),
  address: zAddress,
  yearBuilt: z.number().int().optional().nullable(),
  lotsCount: z.number().int().optional().nullable(),
  accessCode: z.string().optional(),
  accessNotes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

export const clientLocationsRouter = router({
  listByClient: orgProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [client] = await db
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(
          and(
            eq(schema.clients.id, input.clientId),
            eq(schema.clients.organizationId, ctx.organizationId),
          ),
        )
        .limit(1)

      if (!client) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Client introuvable' })
      }

      return db
        .select()
        .from(schema.clientLocations)
        .where(
          and(
            eq(schema.clientLocations.clientId, input.clientId),
            eq(schema.clientLocations.organizationId, ctx.organizationId),
            isNull(schema.clientLocations.archivedAt),
          ),
        )
        .orderBy(desc(schema.clientLocations.createdAt))
    }),

  create: orgProcedure.input(zLocationInput).mutation(async ({ ctx, input }) => {
    const [client] = await db
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.id, input.clientId),
          eq(schema.clients.organizationId, ctx.organizationId),
        ),
      )
      .limit(1)

    if (!client) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Client introuvable' })
    }

    const [location] = await db
      .insert(schema.clientLocations)
      .values({
        organizationId: ctx.organizationId,
        clientId: input.clientId,
        name: input.name,
        internalCode: input.internalCode || undefined,
        address: input.address,
        yearBuilt: input.yearBuilt ?? undefined,
        lotsCount: input.lotsCount ?? undefined,
        accessCode: input.accessCode || undefined,
        accessNotes: input.accessNotes || undefined,
        tags: input.tags,
        notes: input.notes || undefined,
      })
      .returning()

    return location
  }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: zLocationInput.omit({ clientId: true }).partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ id: schema.clientLocations.id })
        .from(schema.clientLocations)
        .where(
          and(
            eq(schema.clientLocations.id, input.id),
            eq(schema.clientLocations.organizationId, ctx.organizationId),
          ),
        )
        .limit(1)

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Lieu introuvable' })
      }

      const [location] = await db
        .update(schema.clientLocations)
        .set({
          ...input.data,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.clientLocations.id, input.id),
            eq(schema.clientLocations.organizationId, ctx.organizationId),
          ),
        )
        .returning()

      return location
    }),

  archive: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(schema.clientLocations)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(schema.clientLocations.id, input.id),
            eq(schema.clientLocations.organizationId, ctx.organizationId),
          ),
        )

      return { ok: true }
    }),
})

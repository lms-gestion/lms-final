import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@lms/db'
import { orgProcedure, router } from '../server'

const trades = [
  'plomberie',
  'electricite',
  'serrurerie',
  'menuiserie',
  'peinture',
  'maconnerie',
  'chauffage',
  'climatisation',
  'multiservices',
] as const

const technicianInput = z.object({
  firstName: z.string().min(1, 'Prenom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  agencyId: z.string().uuid().optional().nullable(),
  trades: z.array(z.enum(trades)).default([]),
  isExternal: z.boolean().default(false),
  vehicle: z.string().optional(),
  hourlyCost: z.string().optional(),
  notes: z.string().optional(),
})

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

export const techniciansRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: schema.technicians.id,
        organizationId: schema.technicians.organizationId,
        agencyId: schema.technicians.agencyId,
        firstName: schema.technicians.firstName,
        lastName: schema.technicians.lastName,
        phone: schema.technicians.phone,
        email: schema.technicians.email,
        avatarUrl: schema.technicians.avatarUrl,
        trades: schema.technicians.trades,
        vehicle: schema.technicians.vehicle,
        isExternal: schema.technicians.isExternal,
        hourlyCost: schema.technicians.hourlyCost,
        status: schema.technicians.status,
        notes: schema.technicians.notes,
        createdAt: schema.technicians.createdAt,
        updatedAt: schema.technicians.updatedAt,
        agencyName: schema.agencies.name,
        agencyCode: schema.agencies.code,
      })
      .from(schema.technicians)
      .leftJoin(schema.agencies, eq(schema.technicians.agencyId, schema.agencies.id))
      .where(eq(schema.technicians.organizationId, ctx.organizationId))
      .orderBy(desc(schema.technicians.createdAt))
  }),

  create: orgProcedure.input(technicianInput).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Seuls owner et admin peuvent creer un technicien',
      })
    }

    let agencyId = input.agencyId ?? null

    if (!agencyId) {
      const agency = await getOrCreateDefaultAgency(ctx.organizationId)

      if (!agency) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Impossible de creer agence principale',
        })
      }

      agencyId = agency.id
    }

    const [technician] = await db
      .insert(schema.technicians)
      .values({
        organizationId: ctx.organizationId,
        agencyId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || undefined,
        email: input.email || undefined,
        trades: input.trades,
        isExternal: input.isExternal,
        vehicle: input.vehicle || undefined,
        hourlyCost: input.hourlyCost || undefined,
        notes: input.notes || undefined,
        status: 'active',
      })
      .returning()

    return technician
  }),

  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: technicianInput.partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!['owner', 'admin'].includes(ctx.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' })
      }

      const values: Record<string, unknown> = {
        updatedAt: new Date(),
      }

      if (input.data.firstName !== undefined) values.firstName = input.data.firstName
      if (input.data.lastName !== undefined) values.lastName = input.data.lastName
      if (input.data.agencyId) values.agencyId = input.data.agencyId
      if (input.data.trades !== undefined) values.trades = input.data.trades
      if (input.data.isExternal !== undefined) values.isExternal = input.data.isExternal
      if (input.data.hourlyCost !== undefined) values.hourlyCost = input.data.hourlyCost
      if (input.data.email !== undefined) values.email = input.data.email || null
      if (input.data.phone !== undefined) values.phone = input.data.phone || null
      if (input.data.vehicle !== undefined) values.vehicle = input.data.vehicle || null
      if (input.data.notes !== undefined) values.notes = input.data.notes || null

      const [technician] = await db
        .update(schema.technicians)
        .set(values)
        .where(
          and(
            eq(schema.technicians.id, input.id),
            eq(schema.technicians.organizationId, ctx.organizationId),
          ),
        )
        .returning()

      return technician
    }),

  deactivate: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    await db
      .update(schema.technicians)
      .set({
        status: 'inactive',
        terminationDate: new Date().toISOString().slice(0, 10),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.technicians.id, input.id),
          eq(schema.technicians.organizationId, ctx.organizationId),
        ),
      )

    return { ok: true }
  }),
})

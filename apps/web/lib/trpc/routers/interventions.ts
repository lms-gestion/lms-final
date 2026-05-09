import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@lms/db'
import { orgProcedure, router } from '../server'

const interventionTypes = [
  'diagnostic',
  'reparation',
  'travaux',
  'controle',
  'urgence',
  'livraison',
  'autre',
] as const

const interventionStatuses = [
  'planifiee',
  'en_cours',
  'terminee',
  'annulee',
  'reportee',
] as const

const createInput = z.object({
  chantierId: z.string().uuid(),
  technicianId: z.string().uuid(),
  type: z.enum(interventionTypes).default('reparation'),
  title: z.string().optional(),
  scheduledAt: z.string().min(1, 'Date requise'),
  durationMinutes: z.number().int().min(15).max(1440).default(60),
  notes: z.string().optional(),
})

const updateStatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(interventionStatuses),
})

async function assertChantierInOrg(chantierId: string, organizationId: string) {
  const [chantier] = await db
    .select({
      id: schema.chantiers.id,
      agencyId: schema.chantiers.agencyId,
      title: schema.chantiers.title,
    })
    .from(schema.chantiers)
    .where(
      and(
        eq(schema.chantiers.id, chantierId),
        eq(schema.chantiers.organizationId, organizationId),
        isNull(schema.chantiers.archivedAt),
      ),
    )
    .limit(1)

  if (!chantier) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Chantier introuvable',
    })
  }

  return chantier
}

async function assertTechnicianInOrg(technicianId: string, organizationId: string) {
  const [technician] = await db
    .select({
      id: schema.technicians.id,
      firstName: schema.technicians.firstName,
      lastName: schema.technicians.lastName,
    })
    .from(schema.technicians)
    .where(
      and(
        eq(schema.technicians.id, technicianId),
        eq(schema.technicians.organizationId, organizationId),
        eq(schema.technicians.status, 'active'),
      ),
    )
    .limit(1)

  if (!technician) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Technicien introuvable ou inactif',
    })
  }

  return technician
}

export const interventionsRouter = router({
  list: orgProcedure
    .input(
      z
        .object({
          chantierId: z.string().uuid().optional().nullable(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const whereClause = input?.chantierId
        ? and(
            eq(schema.interventions.organizationId, ctx.organizationId),
            eq(schema.interventions.chantierId, input.chantierId),
          )
        : eq(schema.interventions.organizationId, ctx.organizationId)

      return db
        .select({
          id: schema.interventions.id,
          organizationId: schema.interventions.organizationId,
          chantierId: schema.interventions.chantierId,
          technicianId: schema.interventions.technicianId,
          type: schema.interventions.type,
          title: schema.interventions.title,
          scheduledAt: schema.interventions.scheduledAt,
          durationMinutes: schema.interventions.durationMinutes,
          status: schema.interventions.status,
          arrivedAt: schema.interventions.arrivedAt,
          completedAt: schema.interventions.completedAt,
          notes: schema.interventions.notes,
          report: schema.interventions.report,
          cancellationReason: schema.interventions.cancellationReason,
          cancelledAt: schema.interventions.cancelledAt,
          createdAt: schema.interventions.createdAt,
          updatedAt: schema.interventions.updatedAt,
          chantierReference: schema.chantiers.reference,
          chantierTitle: schema.chantiers.title,
          clientName: schema.clients.name,
          technicianFirstName: schema.technicians.firstName,
          technicianLastName: schema.technicians.lastName,
        })
        .from(schema.interventions)
        .leftJoin(schema.chantiers, eq(schema.interventions.chantierId, schema.chantiers.id))
        .leftJoin(schema.clients, eq(schema.chantiers.clientId, schema.clients.id))
        .leftJoin(schema.technicians, eq(schema.interventions.technicianId, schema.technicians.id))
        .where(whereClause)
        .orderBy(asc(schema.interventions.scheduledAt))
    }),

  selectors: orgProcedure.query(async ({ ctx }) => {
    const chantiers = await db
      .select({
        id: schema.chantiers.id,
        reference: schema.chantiers.reference,
        title: schema.chantiers.title,
        clientName: schema.clients.name,
        status: schema.chantiers.status,
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

    const technicians = await db
      .select({
        id: schema.technicians.id,
        firstName: schema.technicians.firstName,
        lastName: schema.technicians.lastName,
        trades: schema.technicians.trades,
      })
      .from(schema.technicians)
      .where(
        and(
          eq(schema.technicians.organizationId, ctx.organizationId),
          eq(schema.technicians.status, 'active'),
        ),
      )
      .orderBy(asc(schema.technicians.lastName))

    return {
      chantiers,
      technicians,
      interventionTypes,
      interventionStatuses,
    }
  }),

  create: orgProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin', 'technician'].includes(ctx.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Droits insuffisants',
      })
    }

    const scheduledAt = new Date(input.scheduledAt)

    if (Number.isNaN(scheduledAt.getTime())) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Date invalide',
      })
    }

    await assertChantierInOrg(input.chantierId, ctx.organizationId)
    await assertTechnicianInOrg(input.technicianId, ctx.organizationId)

    const [intervention] = await db
      .insert(schema.interventions)
      .values({
        organizationId: ctx.organizationId,
        chantierId: input.chantierId,
        technicianId: input.technicianId,
        type: input.type,
        title: input.title || undefined,
        scheduledAt,
        durationMinutes: input.durationMinutes,
        status: 'planifiee',
        notes: input.notes || undefined,
      })
      .returning()

    return intervention
  }),

  updateStatus: orgProcedure.input(updateStatusInput).mutation(async ({ ctx, input }) => {
    const now = new Date()

    const values: Record<string, unknown> = {
      status: input.status,
      updatedAt: now,
    }

    if (input.status === 'planifiee') {
      values.arrivedAt = null
      values.completedAt = null
      values.cancelledAt = null
      values.cancellationReason = null
    }

    if (input.status === 'en_cours') {
      values.arrivedAt = now
      values.completedAt = null
      values.cancelledAt = null
      values.cancellationReason = null
    }

    if (input.status === 'terminee') {
      values.completedAt = now
      values.cancelledAt = null
      values.cancellationReason = null
    }

    if (input.status === 'annulee') {
      values.cancelledAt = now
    }

    if (input.status === 'reportee') {
      values.arrivedAt = null
      values.completedAt = null
      values.cancelledAt = null
      values.cancellationReason = null
    }

    const [intervention] = await db
      .update(schema.interventions)
      .set(values)
      .where(
        and(
          eq(schema.interventions.id, input.id),
          eq(schema.interventions.organizationId, ctx.organizationId),
        ),
      )
      .returning()

    if (!intervention) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Intervention introuvable',
      })
    }

    return intervention
  }),
})

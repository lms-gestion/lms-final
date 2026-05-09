import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@lms/db'
import { orgProcedure, router } from '../server'

const chantierPriority = ['normal', 'haute', 'urgence'] as const

const addressInput = z
  .object({
    street: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .optional()

const createChantierInput = z.object({
  clientId: z.string().uuid(),
  locationId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  assignedTechnicianId: z.string().uuid().optional().nullable(),
  agencyId: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Titre requis'),
  description: z.string().optional(),
  metier: z.string().min(1, 'Metier requis'),
  priority: z.enum(chantierPriority).default('normal'),
  tenantName: z.string().optional(),
  tenantPhone: z.string().optional(),
  tenantEmail: z.string().email().optional().or(z.literal('')),
  supplierReference: z.string().optional(),
  scheduledDate: z.string().optional(),
  deadlineDate: z.string().optional(),
  estimatedDurationHours: z.string().optional(),
  notes: z.string().optional(),
  address: addressInput,
})

const updateChantierInput = z.object({
  id: z.string().uuid(),
  data: createChantierInput.partial(),
})

function generateReference() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()

  return 'CH-' + year + month + day + '-' + suffix
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

async function getOrCreateDefaultColumns(organizationId: string) {
  const existing = await db
    .select()
    .from(schema.chantierColumns)
    .where(eq(schema.chantierColumns.organizationId, organizationId))
    .orderBy(asc(schema.chantierColumns.position))

  if (existing.length > 0) return existing

  const defaults = [
    {
      position: 10,
      key: 'nouveau',
      label: 'Nouveau',
      emoji: null,
      color: '#334155',
      bgColor: '#f8fafc',
      borderColor: '#e2e8f0',
      isInitial: true,
      isTerminal: false,
    },
    {
      position: 20,
      key: 'a_planifier',
      label: 'A planifier',
      emoji: null,
      color: '#7c2d12',
      bgColor: '#fff7ed',
      borderColor: '#fed7aa',
      isInitial: false,
      isTerminal: false,
    },
    {
      position: 30,
      key: 'planifie',
      label: 'Planifie',
      emoji: null,
      color: '#1e3a8a',
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
      isInitial: false,
      isTerminal: false,
    },
    {
      position: 40,
      key: 'en_cours',
      label: 'En cours',
      emoji: null,
      color: '#854d0e',
      bgColor: '#fefce8',
      borderColor: '#fde68a',
      isInitial: false,
      isTerminal: false,
    },
    {
      position: 50,
      key: 'termine',
      label: 'Termine',
      emoji: null,
      color: '#166534',
      bgColor: '#f0fdf4',
      borderColor: '#bbf7d0',
      isInitial: false,
      isTerminal: true,
    },
    {
      position: 60,
      key: 'facture',
      label: 'Facture',
      emoji: null,
      color: '#581c87',
      bgColor: '#faf5ff',
      borderColor: '#e9d5ff',
      isInitial: false,
      isTerminal: true,
    },
  ]

  await db.insert(schema.chantierColumns).values(
    defaults.map((column) => ({
      organizationId,
      ...column,
    })),
  )

  return db
    .select()
    .from(schema.chantierColumns)
    .where(eq(schema.chantierColumns.organizationId, organizationId))
    .orderBy(asc(schema.chantierColumns.position))
}

async function assertClientInOrg(clientId: string, organizationId: string) {
  const [client] = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.id, clientId), eq(schema.clients.organizationId, organizationId)))
    .limit(1)

  if (!client) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Client introuvable',
    })
  }

  return client
}

async function assertLocationForClient(
  locationId: string | null | undefined,
  clientId: string,
  organizationId: string,
) {
  if (!locationId) return

  const [location] = await db
    .select()
    .from(schema.clientLocations)
    .where(
      and(
        eq(schema.clientLocations.id, locationId),
        eq(schema.clientLocations.clientId, clientId),
        eq(schema.clientLocations.organizationId, organizationId),
      ),
    )
    .limit(1)

  if (!location) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Lieu invalide pour ce client',
    })
  }
}

export const chantiersRouter = router({
  board: orgProcedure.query(async ({ ctx }) => {
    const columns = await getOrCreateDefaultColumns(ctx.organizationId)

    const chantiers = await db
      .select({
        id: schema.chantiers.id,
        organizationId: schema.chantiers.organizationId,
        agencyId: schema.chantiers.agencyId,
        reference: schema.chantiers.reference,
        clientId: schema.chantiers.clientId,
        locationId: schema.chantiers.locationId,
        metier: schema.chantiers.metier,
        priority: schema.chantiers.priority,
        status: schema.chantiers.status,
        title: schema.chantiers.title,
        description: schema.chantiers.description,
        tenantName: schema.chantiers.tenantName,
        tenantPhone: schema.chantiers.tenantPhone,
        supplierReference: schema.chantiers.supplierReference,
        assignedTechnicianId: schema.chantiers.assignedTechnicianId,
        supplierId: schema.chantiers.supplierId,
        scheduledDate: schema.chantiers.scheduledDate,
        deadlineDate: schema.chantiers.deadlineDate,
        estimatedDurationHours: schema.chantiers.estimatedDurationHours,
        notes: schema.chantiers.notes,
        createdAt: schema.chantiers.createdAt,
        updatedAt: schema.chantiers.updatedAt,
        clientName: schema.clients.name,
        locationName: schema.clientLocations.name,
        technicianFirstName: schema.technicians.firstName,
        technicianLastName: schema.technicians.lastName,
        supplierName: schema.suppliers.name,
        agencyName: schema.agencies.name,
      })
      .from(schema.chantiers)
      .leftJoin(schema.clients, eq(schema.chantiers.clientId, schema.clients.id))
      .leftJoin(schema.clientLocations, eq(schema.chantiers.locationId, schema.clientLocations.id))
      .leftJoin(schema.technicians, eq(schema.chantiers.assignedTechnicianId, schema.technicians.id))
      .leftJoin(schema.suppliers, eq(schema.chantiers.supplierId, schema.suppliers.id))
      .leftJoin(schema.agencies, eq(schema.chantiers.agencyId, schema.agencies.id))
      .where(and(eq(schema.chantiers.organizationId, ctx.organizationId), isNull(schema.chantiers.archivedAt)))
      .orderBy(desc(schema.chantiers.createdAt))

    return {
      columns,
      chantiers,
    }
  }),

  get: orgProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const columns = await getOrCreateDefaultColumns(ctx.organizationId)

    const [chantier] = await db
      .select({
        id: schema.chantiers.id,
        organizationId: schema.chantiers.organizationId,
        agencyId: schema.chantiers.agencyId,
        reference: schema.chantiers.reference,
        clientId: schema.chantiers.clientId,
        locationId: schema.chantiers.locationId,
        supplierId: schema.chantiers.supplierId,
        assignedTechnicianId: schema.chantiers.assignedTechnicianId,
        metier: schema.chantiers.metier,
        priority: schema.chantiers.priority,
        status: schema.chantiers.status,
        title: schema.chantiers.title,
        description: schema.chantiers.description,
        address: schema.chantiers.address,
        tenantName: schema.chantiers.tenantName,
        tenantPhone: schema.chantiers.tenantPhone,
        tenantEmail: schema.chantiers.tenantEmail,
        supplierReference: schema.chantiers.supplierReference,
        scheduledDate: schema.chantiers.scheduledDate,
        deadlineDate: schema.chantiers.deadlineDate,
        estimatedDurationHours: schema.chantiers.estimatedDurationHours,
        notes: schema.chantiers.notes,
        createdAt: schema.chantiers.createdAt,
        updatedAt: schema.chantiers.updatedAt,
        closedAt: schema.chantiers.closedAt,
        clientName: schema.clients.name,
        locationName: schema.clientLocations.name,
        technicianFirstName: schema.technicians.firstName,
        technicianLastName: schema.technicians.lastName,
        supplierName: schema.suppliers.name,
        agencyName: schema.agencies.name,
      })
      .from(schema.chantiers)
      .leftJoin(schema.clients, eq(schema.chantiers.clientId, schema.clients.id))
      .leftJoin(schema.clientLocations, eq(schema.chantiers.locationId, schema.clientLocations.id))
      .leftJoin(schema.technicians, eq(schema.chantiers.assignedTechnicianId, schema.technicians.id))
      .leftJoin(schema.suppliers, eq(schema.chantiers.supplierId, schema.suppliers.id))
      .leftJoin(schema.agencies, eq(schema.chantiers.agencyId, schema.agencies.id))
      .where(
        and(
          eq(schema.chantiers.id, input.id),
          eq(schema.chantiers.organizationId, ctx.organizationId),
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

    return {
      chantier,
      columns,
    }
  }),

  selectors: orgProcedure.query(async ({ ctx }) => {
    const agency = await getOrCreateDefaultAgency(ctx.organizationId)
    const columns = await getOrCreateDefaultColumns(ctx.organizationId)

    const clients = await db
      .select({
        id: schema.clients.id,
        name: schema.clients.name,
        type: schema.clients.type,
      })
      .from(schema.clients)
      .where(and(eq(schema.clients.organizationId, ctx.organizationId), isNull(schema.clients.archivedAt)))
      .orderBy(asc(schema.clients.name))

    const locations = await db
      .select({
        id: schema.clientLocations.id,
        clientId: schema.clientLocations.clientId,
        name: schema.clientLocations.name,
        address: schema.clientLocations.address,
      })
      .from(schema.clientLocations)
      .where(and(eq(schema.clientLocations.organizationId, ctx.organizationId), isNull(schema.clientLocations.archivedAt)))
      .orderBy(asc(schema.clientLocations.name))

    const technicians = await db
      .select({
        id: schema.technicians.id,
        firstName: schema.technicians.firstName,
        lastName: schema.technicians.lastName,
        trades: schema.technicians.trades,
        status: schema.technicians.status,
      })
      .from(schema.technicians)
      .where(and(eq(schema.technicians.organizationId, ctx.organizationId), eq(schema.technicians.status, 'active')))
      .orderBy(asc(schema.technicians.lastName))

    const suppliers = await db
      .select({
        id: schema.suppliers.id,
        name: schema.suppliers.name,
        type: schema.suppliers.type,
      })
      .from(schema.suppliers)
      .where(and(eq(schema.suppliers.organizationId, ctx.organizationId), isNull(schema.suppliers.archivedAt)))
      .orderBy(asc(schema.suppliers.name))

    const agencies = await db
      .select({
        id: schema.agencies.id,
        name: schema.agencies.name,
        code: schema.agencies.code,
      })
      .from(schema.agencies)
      .where(eq(schema.agencies.organizationId, ctx.organizationId))
      .orderBy(asc(schema.agencies.name))

    return {
      defaultAgencyId: agency.id,
      columns,
      clients,
      locations,
      technicians,
      suppliers,
      agencies,
    }
  }),

  create: orgProcedure.input(createChantierInput).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Seuls owner et admin peuvent creer un chantier',
      })
    }

    const client = await assertClientInOrg(input.clientId, ctx.organizationId)

    let agencyId = input.agencyId ?? client.defaultAgencyId ?? null

    if (!agencyId) {
      const agency = await getOrCreateDefaultAgency(ctx.organizationId)
      agencyId = agency.id
    }

    const columns = await getOrCreateDefaultColumns(ctx.organizationId)
    const initialColumn = columns.find((column) => column.isInitial) ?? columns[0]

    if (!initialColumn) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Aucune colonne kanban disponible',
      })
    }

    await assertLocationForClient(input.locationId, input.clientId, ctx.organizationId)

    const [chantier] = await db
      .insert(schema.chantiers)
      .values({
        organizationId: ctx.organizationId,
        agencyId,
        reference: generateReference(),
        clientId: input.clientId,
        locationId: input.locationId || undefined,
        supplierId: input.supplierId || undefined,
        assignedTechnicianId: input.assignedTechnicianId || undefined,
        metier: input.metier,
        priority: input.priority,
        status: initialColumn.key,
        title: input.title,
        description: input.description || undefined,
        address: input.address,
        tenantName: input.tenantName || undefined,
        tenantPhone: input.tenantPhone || undefined,
        tenantEmail: input.tenantEmail || undefined,
        supplierReference: input.supplierReference || undefined,
        scheduledDate: input.scheduledDate || undefined,
        deadlineDate: input.deadlineDate || undefined,
        estimatedDurationHours: input.estimatedDurationHours || undefined,
        notes: input.notes || undefined,
        tags: [],
      })
      .returning()

    return chantier
  }),

  update: orgProcedure.input(updateChantierInput).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Seuls owner et admin peuvent modifier un chantier',
      })
    }

    const [existing] = await db
      .select()
      .from(schema.chantiers)
      .where(and(eq(schema.chantiers.id, input.id), eq(schema.chantiers.organizationId, ctx.organizationId)))
      .limit(1)

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Chantier introuvable',
      })
    }

    const nextClientId = input.data.clientId ?? existing.clientId

    if (input.data.clientId) {
      await assertClientInOrg(input.data.clientId, ctx.organizationId)
    }

    await assertLocationForClient(input.data.locationId, nextClientId, ctx.organizationId)

    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (input.data.clientId !== undefined) values.clientId = input.data.clientId
    if (input.data.locationId !== undefined) values.locationId = input.data.locationId || null
    if (input.data.supplierId !== undefined) values.supplierId = input.data.supplierId || null
    if (input.data.assignedTechnicianId !== undefined) {
      values.assignedTechnicianId = input.data.assignedTechnicianId || null
    }
    if (input.data.agencyId !== undefined) values.agencyId = input.data.agencyId || existing.agencyId
    if (input.data.title !== undefined) values.title = input.data.title
    if (input.data.description !== undefined) values.description = input.data.description || null
    if (input.data.metier !== undefined) values.metier = input.data.metier
    if (input.data.priority !== undefined) values.priority = input.data.priority
    if (input.data.tenantName !== undefined) values.tenantName = input.data.tenantName || null
    if (input.data.tenantPhone !== undefined) values.tenantPhone = input.data.tenantPhone || null
    if (input.data.tenantEmail !== undefined) values.tenantEmail = input.data.tenantEmail || null
    if (input.data.supplierReference !== undefined) {
      values.supplierReference = input.data.supplierReference || null
    }
    if (input.data.scheduledDate !== undefined) values.scheduledDate = input.data.scheduledDate || null
    if (input.data.deadlineDate !== undefined) values.deadlineDate = input.data.deadlineDate || null
    if (input.data.estimatedDurationHours !== undefined) {
      values.estimatedDurationHours = input.data.estimatedDurationHours || null
    }
    if (input.data.notes !== undefined) values.notes = input.data.notes || null
    if (input.data.address !== undefined) values.address = input.data.address

    const [chantier] = await db
      .update(schema.chantiers)
      .set(values)
      .where(and(eq(schema.chantiers.id, input.id), eq(schema.chantiers.organizationId, ctx.organizationId)))
      .returning()

    return chantier
  }),

  move: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [column] = await db
        .select()
        .from(schema.chantierColumns)
        .where(and(eq(schema.chantierColumns.organizationId, ctx.organizationId), eq(schema.chantierColumns.key, input.status)))
        .limit(1)

      if (!column) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Colonne invalide',
        })
      }

      const [chantier] = await db
        .update(schema.chantiers)
        .set({
          status: input.status,
          updatedAt: new Date(),
          closedAt: column.isTerminal ? new Date() : null,
        })
        .where(and(eq(schema.chantiers.id, input.id), eq(schema.chantiers.organizationId, ctx.organizationId)))
        .returning()

      return chantier
    }),

  archive: orgProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    if (!['owner', 'admin'].includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }

    await db
      .update(schema.chantiers)
      .set({
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.chantiers.id, input.id), eq(schema.chantiers.organizationId, ctx.organizationId)))

    return { ok: true }
  }),
})

cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Arret Node..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Creation du module Fiche Chantier..." -ForegroundColor Cyan

@'
const fs = require("fs");
const path = require("path");

const root = process.cwd();

function writeFile(filePath, content) {
  const full = path.join(root, filePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  console.log("OK write " + filePath);
}

function patchFile(filePath, patcher) {
  const full = path.join(root, filePath);
  if (!fs.existsSync(full)) {
    console.log("SKIP missing " + filePath);
    return;
  }

  const before = fs.readFileSync(full, "utf8");
  const after = patcher(before);

  if (after !== before) {
    fs.writeFileSync(full, after, "utf8");
    console.log("OK patch " + filePath);
  } else {
    console.log("SKIP no change " + filePath);
  }
}

writeFile("apps/web/lib/trpc/routers/chantiers.ts", String.raw`import { TRPCError } from '@trpc/server'
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
`);

writeFile("apps/web/app/(app)/chantiers/[id]/page.tsx", String.raw`import { ChantierDetailClient } from './chantier-detail-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ChantierDetailPage({ params }: { params: { id: string } }) {
  return <ChantierDetailClient id={params.id} />
}
`);

writeFile("apps/web/app/(app)/chantiers/[id]/chantier-detail-client.tsx", String.raw`'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'

const metiers = [
  'plomberie',
  'electricite',
  'serrurerie',
  'menuiserie',
  'peinture',
  'maconnerie',
  'chauffage',
  'climatisation',
  'multiservices',
]

const emptyForm = {
  clientId: '',
  locationId: '',
  supplierId: '',
  assignedTechnicianId: '',
  title: '',
  description: '',
  metier: 'plomberie',
  priority: 'normal' as 'normal' | 'haute' | 'urgence',
  tenantName: '',
  tenantPhone: '',
  tenantEmail: '',
  supplierReference: '',
  scheduledDate: '',
  deadlineDate: '',
  estimatedDurationHours: '',
  notes: '',
}

export function ChantierDetailClient({ id }: { id: string }) {
  const utils = trpc.useUtils()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const { data: detail, isLoading, error } = trpc.chantiers.get.useQuery({ id })
  const { data: selectors } = trpc.chantiers.selectors.useQuery()

  const updateChantier = trpc.chantiers.update.useMutation({
    onSuccess: async () => {
      await utils.chantiers.get.invalidate({ id })
      await utils.chantiers.board.invalidate()
      setEditing(false)
    },
  })

  const moveChantier = trpc.chantiers.move.useMutation({
    onSuccess: async () => {
      await utils.chantiers.get.invalidate({ id })
      await utils.chantiers.board.invalidate()
    },
  })

  const archiveChantier = trpc.chantiers.archive.useMutation({
    onSuccess: async () => {
      await utils.chantiers.board.invalidate()
      window.location.href = '/chantiers'
    },
  })

  const chantier = detail?.chantier
  const columns = detail?.columns ?? selectors?.columns ?? []

  useEffect(() => {
    if (!chantier) return

    setForm({
      clientId: chantier.clientId ?? '',
      locationId: chantier.locationId ?? '',
      supplierId: chantier.supplierId ?? '',
      assignedTechnicianId: chantier.assignedTechnicianId ?? '',
      title: chantier.title ?? '',
      description: chantier.description ?? '',
      metier: chantier.metier ?? 'plomberie',
      priority: chantier.priority ?? 'normal',
      tenantName: chantier.tenantName ?? '',
      tenantPhone: chantier.tenantPhone ?? '',
      tenantEmail: chantier.tenantEmail ?? '',
      supplierReference: chantier.supplierReference ?? '',
      scheduledDate: chantier.scheduledDate ?? '',
      deadlineDate: chantier.deadlineDate ?? '',
      estimatedDurationHours: chantier.estimatedDurationHours ?? '',
      notes: chantier.notes ?? '',
    })
  }, [chantier])

  const locationsForClient = useMemo(() => {
    if (!selectors?.locations || !form.clientId) return []
    return selectors.locations.filter((location) => location.clientId === form.clientId)
  }, [selectors?.locations, form.clientId])

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    if (!form.clientId) {
      alert('Client requis')
      return
    }

    if (!form.title.trim()) {
      alert('Titre requis')
      return
    }

    await updateChantier.mutateAsync({
      id,
      data: {
        clientId: form.clientId,
        locationId: form.locationId || null,
        supplierId: form.supplierId || null,
        assignedTechnicianId: form.assignedTechnicianId || null,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        metier: form.metier,
        priority: form.priority,
        tenantName: form.tenantName.trim() || undefined,
        tenantPhone: form.tenantPhone.trim() || undefined,
        tenantEmail: form.tenantEmail.trim() || undefined,
        supplierReference: form.supplierReference.trim() || undefined,
        scheduledDate: form.scheduledDate || undefined,
        deadlineDate: form.deadlineDate || undefined,
        estimatedDurationHours: form.estimatedDurationHours.trim() || undefined,
        notes: form.notes.trim() || undefined,
      },
    })
  }

  function priorityClass(priority: string) {
    if (priority === 'urgence') return 'bg-red-100 text-red-700'
    if (priority === 'haute') return 'bg-orange-100 text-orange-700'
    return 'bg-slate-100 text-slate-600'
  }

  function currentColumnLabel(status: string) {
    return columns.find((column) => column.key === status)?.label ?? status
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Chargement du chantier...
        </div>
      </div>
    )
  }

  if (error || !chantier) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Chantier introuvable ou inaccessible.
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Link href="/chantiers" className="text-sm font-medium text-orange-600 hover:text-orange-700">
              Retour kanban
            </Link>
            <span className="text-sm text-slate-300">/</span>
            <span className="text-sm text-slate-500">{chantier.reference}</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">{chantier.title}</h1>

          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {currentColumnLabel(chantier.status)}
            </span>
            <span className={'rounded-full px-3 py-1 text-xs font-semibold ' + priorityClass(chantier.priority)}>
              {chantier.priority}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {chantier.metier}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {editing ? 'Annuler' : 'Modifier'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm('Archiver ce chantier ?')) {
                archiveChantier.mutate({ id })
              }
            }}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Archiver
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Client</p>
          <p className="mt-2 font-semibold text-slate-900">{chantier.clientName ?? 'Non renseigne'}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Lieu</p>
          <p className="mt-2 font-semibold text-slate-900">{chantier.locationName ?? 'Aucun lieu'}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Technicien</p>
          <p className="mt-2 font-semibold text-slate-900">
            {chantier.technicianFirstName
              ? chantier.technicianFirstName + ' ' + chantier.technicianLastName
              : 'Non assigne'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Date planifiee</p>
          <p className="mt-2 font-semibold text-slate-900">{chantier.scheduledDate ?? 'Non planifie'}</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Statut Kanban</h2>
            <p className="text-sm text-slate-500">Deplace rapidement le chantier entre les colonnes.</p>
          </div>

          <select
            value={chantier.status}
            onChange={(e) => moveChantier.mutate({ id, status: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {columns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {editing ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Modifier le chantier</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Client *</span>
              <select
                value={form.clientId}
                onChange={(e) => {
                  setField('clientId', e.target.value)
                  setField('locationId', '')
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Selectionner</option>
                {selectors?.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Lieu</span>
              <select
                value={form.locationId}
                onChange={(e) => setField('locationId', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Aucun lieu specifique</option>
                {locationsForClient.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Titre *</span>
              <input
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Metier</span>
              <select
                value={form.metier}
                onChange={(e) => setField('metier', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {metiers.map((metier) => (
                  <option key={metier} value={metier}>
                    {metier}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Priorite</span>
              <select
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value as 'normal' | 'haute' | 'urgence')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="normal">Normale</option>
                <option value="haute">Haute</option>
                <option value="urgence">Urgence</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Technicien</span>
              <select
                value={form.assignedTechnicianId}
                onChange={(e) => setField('assignedTechnicianId', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Non assigne</option>
                {selectors?.technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.firstName} {technician.lastName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Fournisseur</span>
              <select
                value={form.supplierId}
                onChange={(e) => setField('supplierId', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Aucun</option>
                {selectors?.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Date planifiee</span>
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => setField('scheduledDate', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Date limite</span>
              <input
                type="date"
                value={form.deadlineDate}
                onChange={(e) => setField('deadlineDate', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Occupant</span>
              <input
                value={form.tenantName}
                onChange={(e) => setField('tenantName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Telephone occupant</span>
              <input
                value={form.tenantPhone}
                onChange={(e) => setField('tenantPhone', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes internes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={save}
              disabled={updateChantier.isPending}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {updateChantier.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Description</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {chantier.description || 'Aucune description renseignee.'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Notes internes</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {chantier.notes || 'Aucune note interne.'}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Informations</h2>

              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Reference</dt>
                  <dd className="font-medium text-slate-900">{chantier.reference}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Agence</dt>
                  <dd className="font-medium text-slate-900">{chantier.agencyName ?? 'Agence principale'}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Fournisseur</dt>
                  <dd className="font-medium text-slate-900">{chantier.supplierName ?? 'Aucun'}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Occupant</dt>
                  <dd className="font-medium text-slate-900">{chantier.tenantName ?? 'Non renseigne'}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Telephone occupant</dt>
                  <dd className="font-medium text-slate-900">{chantier.tenantPhone ?? 'Non renseigne'}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Date limite</dt>
                  <dd className="font-medium text-slate-900">{chantier.deadlineDate ?? 'Non renseignee'}</dd>
                </div>

                <div>
                  <dt className="text-slate-500">Cree le</dt>
                  <dd className="font-medium text-slate-900">
                    {chantier.createdAt ? new Date(chantier.createdAt).toLocaleDateString('fr-FR') : '-'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
`);

patchFile("apps/web/app/(app)/chantiers/chantiers-kanban-client.tsx", (content) => {
  let next = content;

  if (!next.includes("import Link from 'next/link'")) {
    next = next.replace(
      "import { useMemo, useState } from 'react'",
      "import Link from 'next/link'\nimport { useMemo, useState } from 'react'"
    );
  }

  if (!next.includes("href={'/chantiers/' + chantier.id}")) {
    const marker = `                          <button
                            type="button"
                            onClick={() => archiveChantier.mutate({ id: chantier.id })}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Archiver
                          </button>`;

    const replacement = `                          <Link
                            href={'/chantiers/' + chantier.id}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Ouvrir
                          </Link>

                          <button
                            type="button"
                            onClick={() => archiveChantier.mutate({ id: chantier.id })}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Archiver
                          </button>`;

    next = next.replace(marker, replacement);
  }

  return next;
});

patchFile("apps/web/lib/trpc/root.ts", (content) => {
  let next = content;

  if (!next.includes("import { chantiersRouter } from './routers/chantiers'")) {
    const imports = next.match(/^import .*$/gm) || [];
    const lastImport = imports[imports.length - 1];
    if (lastImport) {
      next = next.replace(lastImport, lastImport + "\nimport { chantiersRouter } from './routers/chantiers'");
    }
  }

  if (!next.includes("chantiers: chantiersRouter")) {
    next = next.replace(
      "export const appRouter = router({",
      "export const appRouter = router({\n  chantiers: chantiersRouter,"
    );
  }

  return next;
});

console.log("Fiche chantier module complete.");
'@ | Set-Content "add-fiche-chantier.js" -Encoding UTF8

Write-Host "Application du script Node..." -ForegroundColor Cyan
node .\add-fiche-chantier.js

Write-Host "Suppression script temporaire..." -ForegroundColor Cyan
Remove-Item "add-fiche-chantier.js" -Force -ErrorAction SilentlyContinue

Write-Host "Nettoyage cache Next/Turbo..." -ForegroundColor Cyan
Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Commit + push GitHub..." -ForegroundColor Cyan
git add .
git commit -m "add chantier detail page"
git push origin main

Write-Host ""
Write-Host "Fiche Chantier ajoutee." -ForegroundColor Green
Write-Host "Relance : npm run dev" -ForegroundColor Green
Write-Host "Teste : http://localhost:3000/chantiers" -ForegroundColor Green
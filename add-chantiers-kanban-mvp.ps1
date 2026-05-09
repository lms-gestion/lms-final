cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Arret Node..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Ajout module Chantiers + Kanban MVP..." -ForegroundColor Cyan

# ------------------------------------------------------------
# 1. Router chantiers
# ------------------------------------------------------------

$ChantiersRouter = "apps\web\lib\trpc\routers\chantiers.ts"

@'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@lms/db'
import { orgProcedure, router } from '../server'

const chantierPriority = ['normal', 'haute', 'urgence'] as const

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
  address: z
    .object({
      street: z.string().optional(),
      postalCode: z.string().optional(),
      city: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
})

function generateReference() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()

  return `CH-${year}${month}${day}-${suffix}`
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
      emoji: '🆕',
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
      emoji: '📅',
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
      emoji: '🗓️',
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
      emoji: '🔧',
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
      emoji: '✅',
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
      emoji: '💶',
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
      .where(
        and(
          eq(schema.chantiers.organizationId, ctx.organizationId),
          isNull(schema.chantiers.archivedAt),
        ),
      )
      .orderBy(desc(schema.chantiers.createdAt))

    return {
      columns,
      chantiers,
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
      .where(
        and(
          eq(schema.clients.organizationId, ctx.organizationId),
          isNull(schema.clients.archivedAt),
        ),
      )
      .orderBy(asc(schema.clients.name))

    const locations = await db
      .select({
        id: schema.clientLocations.id,
        clientId: schema.clientLocations.clientId,
        name: schema.clientLocations.name,
        address: schema.clientLocations.address,
      })
      .from(schema.clientLocations)
      .where(
        and(
          eq(schema.clientLocations.organizationId, ctx.organizationId),
          isNull(schema.clientLocations.archivedAt),
        ),
      )
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
      .where(
        and(
          eq(schema.technicians.organizationId, ctx.organizationId),
          eq(schema.technicians.status, 'active'),
        ),
      )
      .orderBy(asc(schema.technicians.lastName))

    const suppliers = await db
      .select({
        id: schema.suppliers.id,
        name: schema.suppliers.name,
        type: schema.suppliers.type,
      })
      .from(schema.suppliers)
      .where(
        and(
          eq(schema.suppliers.organizationId, ctx.organizationId),
          isNull(schema.suppliers.archivedAt),
        ),
      )
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

    const [client] = await db
      .select()
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.id, input.clientId),
          eq(schema.clients.organizationId, ctx.organizationId),
        ),
      )
      .limit(1)

    if (!client) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Client introuvable',
      })
    }

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

    if (input.locationId) {
      const [location] = await db
        .select()
        .from(schema.clientLocations)
        .where(
          and(
            eq(schema.clientLocations.id, input.locationId),
            eq(schema.clientLocations.clientId, input.clientId),
            eq(schema.clientLocations.organizationId, ctx.organizationId),
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
        .where(
          and(
            eq(schema.chantierColumns.organizationId, ctx.organizationId),
            eq(schema.chantierColumns.key, input.status),
          ),
        )
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
        .where(
          and(
            eq(schema.chantiers.id, input.id),
            eq(schema.chantiers.organizationId, ctx.organizationId),
          ),
        )
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
      .where(
        and(
          eq(schema.chantiers.id, input.id),
          eq(schema.chantiers.organizationId, ctx.organizationId),
        ),
      )

    return { ok: true }
  }),
})
'@ | Set-Content $ChantiersRouter -Encoding UTF8

# ------------------------------------------------------------
# 2. Patch tRPC root
# ------------------------------------------------------------

@'
const fs = require("fs");

const rootPath = "apps/web/lib/trpc/root.ts";
let content = fs.readFileSync(rootPath, "utf8");

function addImport(line) {
  if (content.includes(line)) return;

  const importLines = content.match(/^import .*$/gm) || [];
  if (importLines.length === 0) {
    content = line + "\n" + content;
    return;
  }

  const lastImport = importLines[importLines.length - 1];
  content = content.replace(lastImport, lastImport + "\n" + line);
}

addImport("import { chantiersRouter } from './routers/chantiers'");

if (!content.includes("chantiers: chantiersRouter")) {
  content = content.replace(
    "export const appRouter = router({",
    "export const appRouter = router({\n  chantiers: chantiersRouter,"
  );
}

fs.writeFileSync(rootPath, content, "utf8");
console.log("root.ts patched with chantiers router");
'@ | Set-Content "patch-trpc-root-chantiers.js" -Encoding UTF8

node .\patch-trpc-root-chantiers.js
Remove-Item "patch-trpc-root-chantiers.js" -Force -ErrorAction SilentlyContinue

# ------------------------------------------------------------
# 3. Page Chantiers
# ------------------------------------------------------------

New-Item -ItemType Directory -Force "apps\web\app\(app)\chantiers" | Out-Null

@'
import { ChantiersKanbanClient } from './chantiers-kanban-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ChantiersPage() {
  return <ChantiersKanbanClient />
}
'@ | Set-Content "apps\web\app\(app)\chantiers\page.tsx" -Encoding UTF8

@'
'use client'

import { useMemo, useState } from 'react'
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
  supplierReference: '',
  scheduledDate: '',
  deadlineDate: '',
  estimatedDurationHours: '',
  notes: '',
}

export function ChantiersKanbanClient() {
  const utils = trpc.useUtils()

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)

  const { data: board, isLoading } = trpc.chantiers.board.useQuery()
  const { data: selectors } = trpc.chantiers.selectors.useQuery()

  const createChantier = trpc.chantiers.create.useMutation({
    onSuccess: async () => {
      await utils.chantiers.board.invalidate()
      setForm(emptyForm)
      setOpen(false)
    },
  })

  const moveChantier = trpc.chantiers.move.useMutation({
    onSuccess: async () => {
      await utils.chantiers.board.invalidate()
    },
  })

  const archiveChantier = trpc.chantiers.archive.useMutation({
    onSuccess: async () => {
      await utils.chantiers.board.invalidate()
    },
  })

  const columns = board?.columns ?? []
  const chantiers = board?.chantiers ?? []

  const locationsForClient = useMemo(() => {
    if (!selectors?.locations || !form.clientId) return []
    return selectors.locations.filter((location) => location.clientId === form.clientId)
  }, [selectors?.locations, form.clientId])

  const filteredChantiers = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return chantiers

    return chantiers.filter((chantier) => {
      return [
        chantier.reference,
        chantier.title,
        chantier.clientName,
        chantier.locationName,
        chantier.metier,
        chantier.tenantName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    })
  }, [chantiers, search])

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit() {
    if (!form.clientId) {
      alert('Client requis')
      return
    }

    if (!form.title.trim()) {
      alert('Titre requis')
      return
    }

    await createChantier.mutateAsync({
      clientId: form.clientId,
      locationId: form.locationId || null,
      supplierId: form.supplierId || null,
      assignedTechnicianId: form.assignedTechnicianId || null,
      agencyId: selectors?.defaultAgencyId ?? null,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      metier: form.metier,
      priority: form.priority,
      tenantName: form.tenantName.trim() || undefined,
      tenantPhone: form.tenantPhone.trim() || undefined,
      supplierReference: form.supplierReference.trim() || undefined,
      scheduledDate: form.scheduledDate || undefined,
      deadlineDate: form.deadlineDate || undefined,
      estimatedDurationHours: form.estimatedDurationHours.trim() || undefined,
      notes: form.notes.trim() || undefined,
    })
  }

  function move(id: string, currentStatus: string, direction: -1 | 1) {
    const index = columns.findIndex((column) => column.key === currentStatus)
    const target = columns[index + direction]

    if (!target) return

    moveChantier.mutate({
      id,
      status: target.key,
    })
  }

  function priorityClass(priority: string) {
    if (priority === 'urgence') return 'bg-red-100 text-red-700'
    if (priority === 'haute') return 'bg-orange-100 text-orange-700'
    return 'bg-slate-100 text-slate-600'
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chantiers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kanban de suivi des demandes, travaux, interventions et facturation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {open ? 'Fermer' : '+ Nouveau chantier'}
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un chantier, client, reference..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm md:max-w-md"
        />

        <div className="text-sm text-slate-500">
          {filteredChantiers.length} chantier(s)
        </div>
      </div>

      {open && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Creer un chantier</h2>

          {selectors?.clients.length === 0 ? (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
              Aucun client disponible. Cree d'abord un client dans le module Clients.
            </div>
          ) : (
            <>
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
                    disabled={!form.clientId}
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
                    placeholder="Fuite sous evier, remplacement serrure, devis peinture..."
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
                  <span className="text-sm font-medium text-slate-700">Fournisseur / donneur ordre</span>
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
                  <span className="text-sm font-medium text-slate-700">Occupant / locataire</span>
                  <input
                    value={form.tenantName}
                    onChange={(e) => setField('tenantName', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Mme Martin"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Telephone occupant</span>
                  <input
                    value={form.tenantPhone}
                    onChange={(e) => setField('tenantPhone', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="06 00 00 00 00"
                  />
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

                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Description</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                    className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Details de la demande..."
                  />
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={submit}
                  disabled={createChantier.isPending}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {createChantier.isPending ? 'Creation...' : 'Creer le chantier'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Chargement du kanban...
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column, columnIndex) => {
            const cards = filteredChantiers.filter((chantier) => chantier.status === column.key)

            return (
              <div
                key={column.id}
                className="min-w-[300px] max-w-[300px] rounded-xl border border-slate-200 bg-slate-50"
              >
                <div className="sticky top-0 rounded-t-xl border-b border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-slate-900">
                        {column.emoji ? `${column.emoji} ` : ''}
                        {column.label}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">{cards.length} chantier(s)</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-3">
                  {cards.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
                      Aucun chantier
                    </div>
                  ) : (
                    cards.map((chantier) => (
                      <div
                        key={chantier.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-slate-400">
                              {chantier.reference}
                            </p>
                            <h3 className="mt-1 font-semibold text-slate-900">{chantier.title}</h3>
                          </div>

                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityClass(
                              chantier.priority,
                            )}`}
                          >
                            {chantier.priority}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-slate-600">
                          <p>Client : {chantier.clientName ?? 'Non renseigne'}</p>
                          {chantier.locationName && <p>Lieu : {chantier.locationName}</p>}
                          <p>Metier : {chantier.metier}</p>
                          {chantier.technicianFirstName && (
                            <p>
                              Tech : {chantier.technicianFirstName}{' '}
                              {chantier.technicianLastName}
                            </p>
                          )}
                          {chantier.scheduledDate && <p>Planifie : {chantier.scheduledDate}</p>}
                        </div>

                        {chantier.description && (
                          <p className="mt-3 line-clamp-3 text-sm text-slate-500">
                            {chantier.description}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => move(chantier.id, chantier.status, -1)}
                            disabled={columnIndex === 0 || moveChantier.isPending}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 disabled:opacity-40"
                          >
                            ←
                          </button>

                          <button
                            type="button"
                            onClick={() => archiveChantier.mutate({ id: chantier.id })}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Archiver
                          </button>

                          <button
                            type="button"
                            onClick={() => move(chantier.id, chantier.status, 1)}
                            disabled={columnIndex === columns.length - 1 || moveChantier.isPending}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 disabled:opacity-40"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
'@ | Set-Content "apps\web\app\(app)\chantiers\chantiers-kanban-client.tsx" -Encoding UTF8

# ------------------------------------------------------------
# 4. Nettoyage cache
# ------------------------------------------------------------

Write-Host "Nettoyage cache Next/Turbo..." -ForegroundColor Cyan

Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

# ------------------------------------------------------------
# 5. Commit + push
# ------------------------------------------------------------

Write-Host "Commit + push GitHub..." -ForegroundColor Cyan

git add .
git commit -m "add chantiers kanban mvp"
git push origin main

Write-Host ""
Write-Host "Module Chantiers + Kanban ajoute." -ForegroundColor Green
Write-Host "Relance : npm run dev" -ForegroundColor Green
Write-Host "Teste : http://localhost:3000/chantiers" -ForegroundColor Green
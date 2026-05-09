cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Arret Node..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Ajout module Equipe + Fournisseurs..." -ForegroundColor Cyan

# ------------------------------------------------------------
# 1. Router technicians
# ------------------------------------------------------------

$TechniciansRouter = "apps\web\lib\trpc\routers\technicians.ts"

@'
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

      const [technician] = await db
        .update(schema.technicians)
        .set({
          ...input.data,
          email: input.data.email || undefined,
          phone: input.data.phone || undefined,
          vehicle: input.data.vehicle || undefined,
          notes: input.data.notes || undefined,
          updatedAt: new Date(),
        })
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
'@ | Set-Content $TechniciansRouter -Encoding UTF8

# ------------------------------------------------------------
# 2. Router suppliers
# ------------------------------------------------------------

$SuppliersRouter = "apps\web\lib\trpc\routers\suppliers.ts"

@'
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
'@ | Set-Content $SuppliersRouter -Encoding UTF8

# ------------------------------------------------------------
# 3. Patch tRPC root
# ------------------------------------------------------------

@'
const fs = require("fs");

const rootPath = "apps/web/lib/trpc/root.ts";
let content = fs.readFileSync(rootPath, "utf8");

function ensureImport(importLine) {
  if (!content.includes(importLine)) {
    const marker = "import { router } from './server'\n";
    content = content.replace(marker, marker + importLine + "\n");
  }
}

ensureImport("import { techniciansRouter } from './routers/technicians'");
ensureImport("import { suppliersRouter } from './routers/suppliers'");

if (!content.includes("technicians: techniciansRouter")) {
  content = content.replace(
    "export const appRouter = router({",
    "export const appRouter = router({\n  technicians: techniciansRouter,"
  );
}

if (!content.includes("suppliers: suppliersRouter")) {
  content = content.replace(
    "export const appRouter = router({",
    "export const appRouter = router({\n  suppliers: suppliersRouter,"
  );
}

fs.writeFileSync(rootPath, content, "utf8");
console.log("root.ts patched");
'@ | Set-Content "patch-trpc-root-equipe.js" -Encoding UTF8

node .\patch-trpc-root-equipe.js
Remove-Item "patch-trpc-root-equipe.js" -Force -ErrorAction SilentlyContinue

# ------------------------------------------------------------
# 4. Page Equipe
# ------------------------------------------------------------

New-Item -ItemType Directory -Force "apps\web\app\(app)\equipe" | Out-Null

@'
import { EquipeClient } from './equipe-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function EquipePage() {
  return <EquipeClient />
}
'@ | Set-Content "apps\web\app\(app)\equipe\page.tsx" -Encoding UTF8

@'
'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'

const tradeOptions = [
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

type Trade = (typeof tradeOptions)[number]

const emptyForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  vehicle: '',
  hourlyCost: '',
  notes: '',
  isExternal: false,
  trades: [] as Trade[],
}

export function EquipeClient() {
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const { data: technicians = [], isLoading } = trpc.technicians.list.useQuery()

  const createTechnician = trpc.technicians.create.useMutation({
    onSuccess: async () => {
      await utils.technicians.list.invalidate()
      setForm(emptyForm)
      setOpen(false)
    },
  })

  const deactivateTechnician = trpc.technicians.deactivate.useMutation({
    onSuccess: async () => {
      await utils.technicians.list.invalidate()
    },
  })

  const activeCount = useMemo(
    () => technicians.filter((technician) => technician.status === 'active').length,
    [technicians],
  )

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleTrade(trade: Trade) {
    setForm((current) => ({
      ...current,
      trades: current.trades.includes(trade)
        ? current.trades.filter((item) => item !== trade)
        : [...current.trades, trade],
    }))
  }

  async function submit() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      alert('Prenom et nom requis')
      return
    }

    await createTechnician.mutateAsync({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      vehicle: form.vehicle.trim() || undefined,
      hourlyCost: form.hourlyCost.trim() || undefined,
      notes: form.notes.trim() || undefined,
      isExternal: form.isExternal,
      trades: form.trades,
      agencyId: null,
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Equipe</h1>
          <p className="mt-1 text-sm text-slate-500">
            Techniciens internes et intervenants externes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {open ? 'Fermer' : '+ Nouveau technicien'}
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Techniciens actifs</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total equipe</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{technicians.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Externes</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {technicians.filter((technician) => technician.isExternal).length}
          </p>
        </div>
      </div>

      {open && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Creer un technicien</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Prenom *</span>
              <input
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Jean"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Nom *</span>
              <input
                value={form.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Dupont"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Telephone</span>
              <input
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="06 00 00 00 00"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="jean@exemple.fr"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Vehicule</span>
              <input
                value={form.vehicle}
                onChange={(e) => setField('vehicle', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Kangoo blanc"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Cout horaire</span>
              <input
                value={form.hourlyCost}
                onChange={(e) => setField('hourlyCost', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="35.00"
              />
            </label>

            <label className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.isExternal}
                onChange={(e) => setField('isExternal', e.target.checked)}
              />
              <span className="text-sm text-slate-700">Intervenant externe / sous-traitant</span>
            </label>

            <div className="md:col-span-2">
              <p className="mb-2 text-sm font-medium text-slate-700">Metiers</p>
              <div className="flex flex-wrap gap-2">
                {tradeOptions.map((trade) => (
                  <button
                    key={trade}
                    type="button"
                    onClick={() => toggleTrade(trade)}
                    className={
                      form.trades.includes(trade)
                        ? 'rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white'
                        : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200'
                    }
                  >
                    {trade}
                  </button>
                ))}
              </div>
            </div>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Disponibilites, specialites, infos internes..."
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
              disabled={createTechnician.isPending}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {createTechnician.isPending ? 'Creation...' : 'Creer'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Chargement...</div>
        ) : technicians.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-slate-900">Aucun technicien</p>
            <p className="mt-1 text-sm text-slate-500">Ajoute ton premier technicien.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {technicians.map((technician) => (
              <div key={technician.id} className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {technician.firstName} {technician.lastName}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {technician.status}
                    </span>
                    {technician.isExternal && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                        externe
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {[technician.phone, technician.email].filter(Boolean).join(' · ') || 'Coordonnees non renseignees'}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Agence : {technician.agencyName ?? 'Agence principale'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(technician.trades ?? []).map((trade) => (
                      <span key={trade} className="rounded-full bg-orange-50 px-2 py-1 text-xs text-orange-700">
                        {trade}
                      </span>
                    ))}
                  </div>

                  {technician.notes && (
                    <p className="mt-3 text-sm text-slate-600">{technician.notes}</p>
                  )}
                </div>

                {technician.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => deactivateTechnician.mutate({ id: technician.id })}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Desactiver
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
'@ | Set-Content "apps\web\app\(app)\equipe\equipe-client.tsx" -Encoding UTF8

# ------------------------------------------------------------
# 5. Page Fournisseurs
# ------------------------------------------------------------

New-Item -ItemType Directory -Force "apps\web\app\(app)\fournisseurs" | Out-Null

@'
import { FournisseursClient } from './fournisseurs-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function FournisseursPage() {
  return <FournisseursClient />
}
'@ | Set-Content "apps\web\app\(app)\fournisseurs\page.tsx" -Encoding UTF8

@'
'use client'

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'

const supplierTypes = [
  { value: 'donneur_ordre', label: 'Donneur ordre' },
  { value: 'materiel', label: 'Materiel' },
  { value: 'sous_traitant', label: 'Sous-traitant' },
  { value: 'autre', label: 'Autre' },
] as const

type SupplierType = (typeof supplierTypes)[number]['value']

const emptyForm = {
  name: '',
  type: 'autre' as SupplierType,
  legalName: '',
  siret: '',
  tvaIntra: '',
  phone: '',
  email: '',
  website: '',
  primaryContactName: '',
  primaryContactRole: '',
  primaryContactEmail: '',
  primaryContactPhone: '',
  paymentTermsDays: '30',
  paymentMethod: 'virement',
  notes: '',
}

export function FournisseursClient() {
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const { data: suppliers = [], isLoading } = trpc.suppliers.list.useQuery()

  const createSupplier = trpc.suppliers.create.useMutation({
    onSuccess: async () => {
      await utils.suppliers.list.invalidate()
      setForm(emptyForm)
      setOpen(false)
    },
  })

  const archiveSupplier = trpc.suppliers.archive.useMutation({
    onSuccess: async () => {
      await utils.suppliers.list.invalidate()
    },
  })

  const byType = useMemo(() => {
    return suppliers.reduce<Record<string, number>>((acc, supplier) => {
      acc[supplier.type] = (acc[supplier.type] ?? 0) + 1
      return acc
    }, {})
  }, [suppliers])

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit() {
    if (!form.name.trim()) {
      alert('Nom fournisseur requis')
      return
    }

    await createSupplier.mutateAsync({
      name: form.name.trim(),
      type: form.type,
      legalName: form.legalName.trim() || undefined,
      siret: form.siret.trim() || undefined,
      tvaIntra: form.tvaIntra.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      website: form.website.trim() || undefined,
      primaryContactName: form.primaryContactName.trim() || undefined,
      primaryContactRole: form.primaryContactRole.trim() || undefined,
      primaryContactEmail: form.primaryContactEmail.trim() || undefined,
      primaryContactPhone: form.primaryContactPhone.trim() || undefined,
      paymentTermsDays: Number(form.paymentTermsDays || 30),
      paymentMethod: form.paymentMethod.trim() || undefined,
      notes: form.notes.trim() || undefined,
      tags: [],
    })
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fournisseurs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Donneurs d'ordre, materiel, sous-traitants et autres partenaires.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {open ? 'Fermer' : '+ Nouveau fournisseur'}
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{suppliers.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Materiel</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{byType.materiel ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Sous-traitants</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{byType.sous_traitant ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Donneurs ordre</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{byType.donneur_ordre ?? 0}</p>
        </div>
      </div>

      {open && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Creer un fournisseur</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Nom *</span>
              <input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Rexel, Brossette, Sous-traitant ABC..."
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Type</span>
              <select
                value={form.type}
                onChange={(e) => setField('type', e.target.value as SupplierType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {supplierTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Raison sociale</span>
              <input
                value={form.legalName}
                onChange={(e) => setField('legalName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">SIRET</span>
              <input
                value={form.siret}
                onChange={(e) => setField('siret', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Telephone</span>
              <input
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Contact principal</span>
              <input
                value={form.primaryContactName}
                onChange={(e) => setField('primaryContactName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Nom du contact"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Telephone contact</span>
              <input
                value={form.primaryContactPhone}
                onChange={(e) => setField('primaryContactPhone', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Delai paiement</span>
              <input
                value={form.paymentTermsDays}
                onChange={(e) => setField('paymentTermsDays', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="30"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Mode paiement</span>
              <input
                value={form.paymentMethod}
                onChange={(e) => setField('paymentMethod', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="virement"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Conditions, contacts, habitudes..."
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
              disabled={createSupplier.isPending}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {createSupplier.isPending ? 'Creation...' : 'Creer'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Chargement...</div>
        ) : suppliers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-slate-900">Aucun fournisseur</p>
            <p className="mt-1 text-sm text-slate-500">Ajoute ton premier fournisseur.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{supplier.name}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {supplier.type}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {[supplier.phone, supplier.email].filter(Boolean).join(' · ') || 'Coordonnees non renseignees'}
                  </p>

                  {supplier.primaryContactName && (
                    <p className="mt-1 text-sm text-slate-500">
                      Contact : {supplier.primaryContactName}
                      {supplier.primaryContactPhone ? ` · ${supplier.primaryContactPhone}` : ''}
                    </p>
                  )}

                  {supplier.notes && (
                    <p className="mt-3 text-sm text-slate-600">{supplier.notes}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => archiveSupplier.mutate({ id: supplier.id })}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Archiver
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
'@ | Set-Content "apps\web\app\(app)\fournisseurs\fournisseurs-client.tsx" -Encoding UTF8

# ------------------------------------------------------------
# 6. Nettoyage cache
# ------------------------------------------------------------

Write-Host "Nettoyage cache Next/Turbo..." -ForegroundColor Cyan
Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

# ------------------------------------------------------------
# 7. Commit + push
# ------------------------------------------------------------

Write-Host "Commit + push GitHub..." -ForegroundColor Cyan

git add .
git commit -m "add equipe and suppliers modules"
git push origin main

Write-Host ""
Write-Host "Module Equipe + Fournisseurs ajoute." -ForegroundColor Green
Write-Host "Relance : npm run dev" -ForegroundColor Green
Write-Host "Teste : http://localhost:3000/equipe" -ForegroundColor Green
Write-Host "Teste : http://localhost:3000/fournisseurs" -ForegroundColor Green
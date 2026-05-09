02:48 09/05/2026cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Arret Node..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Ajout module Interventions + Planning MVP..." -ForegroundColor Cyan

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

function patchRoot() {
  const rootPath = path.join(root, "apps", "web", "lib", "trpc", "root.ts");
  let content = fs.readFileSync(rootPath, "utf8");

  const importLine = "import { interventionsRouter } from './routers/interventions'";

  if (!content.includes(importLine)) {
    const imports = content.match(/^import .*$/gm) || [];
    const lastImport = imports[imports.length - 1];

    if (lastImport) {
      content = content.replace(lastImport, lastImport + "\n" + importLine);
    } else {
      content = importLine + "\n" + content;
    }
  }

  if (!content.includes("interventions: interventionsRouter")) {
    content = content.replace(
      "export const appRouter = router({",
      "export const appRouter = router({\n  interventions: interventionsRouter,"
    );
  }

  fs.writeFileSync(rootPath, content, "utf8");
  console.log("OK patch apps/web/lib/trpc/root.ts");
}

writeFile("apps/web/lib/trpc/routers/interventions.ts", String.raw`import { TRPCError } from '@trpc/server'
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
      const filters = [
        eq(schema.interventions.organizationId, ctx.organizationId),
      ]

      if (input?.chantierId) {
        filters.push(eq(schema.interventions.chantierId, input.chantierId))
      }

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
        .where(and(...filters))
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
    const values = {
      status: input.status,
      updatedAt: new Date(),
      ...(input.status === 'en_cours' ? { arrivedAt: new Date() } : {}),
      ...(input.status === 'terminee' ? { completedAt: new Date() } : {}),
      ...(input.status === 'annulee' ? { cancelledAt: new Date() } : {}),
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
`);

writeFile("apps/web/app/(app)/planning/page.tsx", String.raw`import { PlanningClient } from './planning-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function PlanningPage() {
  return <PlanningClient />
}
`);

writeFile("apps/web/app/(app)/planning/planning-client.tsx", String.raw`'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'

function defaultDatetimeLocal() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  now.setMinutes(0)
  return now.toISOString().slice(0, 16)
}

const emptyForm = {
  chantierId: '',
  technicianId: '',
  type: 'reparation',
  title: '',
  scheduledAt: defaultDatetimeLocal(),
  durationMinutes: '60',
  notes: '',
}

export function PlanningClient() {
  const utils = trpc.useUtils()

  const [open, setOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState(emptyForm)

  const { data: interventions = [], isLoading } = trpc.interventions.list.useQuery()
  const { data: selectors } = trpc.interventions.selectors.useQuery()

  const createIntervention = trpc.interventions.create.useMutation({
    onSuccess: async () => {
      await utils.interventions.list.invalidate()
      setForm({
        ...emptyForm,
        scheduledAt: defaultDatetimeLocal(),
      })
      setOpen(false)
    },
  })

  const updateStatus = trpc.interventions.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.interventions.list.invalidate()
    },
  })

  const filteredInterventions = useMemo(() => {
    if (statusFilter === 'all') return interventions
    return interventions.filter((intervention) => intervention.status === statusFilter)
  }, [interventions, statusFilter])

  const stats = useMemo(() => {
    return interventions.reduce<Record<string, number>>((acc, intervention) => {
      acc[intervention.status] = (acc[intervention.status] ?? 0) + 1
      return acc
    }, {})
  }, [interventions])

  function setField<K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit() {
    if (!form.chantierId) {
      alert('Chantier requis')
      return
    }

    if (!form.technicianId) {
      alert('Technicien requis')
      return
    }

    await createIntervention.mutateAsync({
      chantierId: form.chantierId,
      technicianId: form.technicianId,
      type: form.type as
        | 'diagnostic'
        | 'reparation'
        | 'travaux'
        | 'controle'
        | 'urgence'
        | 'livraison'
        | 'autre',
      title: form.title.trim() || undefined,
      scheduledAt: form.scheduledAt,
      durationMinutes: Number(form.durationMinutes || 60),
      notes: form.notes.trim() || undefined,
    })
  }

  function statusClass(status: string) {
    if (status === 'terminee') return 'bg-green-100 text-green-700'
    if (status === 'en_cours') return 'bg-orange-100 text-orange-700'
    if (status === 'annulee') return 'bg-red-100 text-red-700'
    if (status === 'reportee') return 'bg-purple-100 text-purple-700'
    return 'bg-blue-100 text-blue-700'
  }

  function formatDate(value: string | Date | null) {
    if (!value) return '-'
    return new Date(value).toLocaleString('fr-FR')
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planning</h1>
          <p className="mt-1 text-sm text-slate-500">
            Interventions planifiees, en cours et terminees.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {open ? 'Fermer' : '+ Nouvelle intervention'}
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
        >
          <p className="text-sm text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{interventions.length}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('planifiee')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
        >
          <p className="text-sm text-slate-500">Planifiees</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.planifiee ?? 0}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('en_cours')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
        >
          <p className="text-sm text-slate-500">En cours</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.en_cours ?? 0}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('terminee')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
        >
          <p className="text-sm text-slate-500">Terminees</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.terminee ?? 0}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('annulee')}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"
        >
          <p className="text-sm text-slate-500">Annulees</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.annulee ?? 0}</p>
        </button>
      </div>

      {open && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Creer une intervention</h2>

          {(selectors?.chantiers.length ?? 0) === 0 || (selectors?.technicians.length ?? 0) === 0 ? (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
              Il faut au moins un chantier et un technicien actif pour creer une intervention.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Chantier *</span>
                  <select
                    value={form.chantierId}
                    onChange={(e) => setField('chantierId', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selectionner</option>
                    {selectors?.chantiers.map((chantier) => (
                      <option key={chantier.id} value={chantier.id}>
                        {chantier.reference} - {chantier.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Technicien *</span>
                  <select
                    value={form.technicianId}
                    onChange={(e) => setField('technicianId', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Selectionner</option>
                    {selectors?.technicians.map((technician) => (
                      <option key={technician.id} value={technician.id}>
                        {technician.firstName} {technician.lastName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Type</span>
                  <select
                    value={form.type}
                    onChange={(e) => setField('type', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="diagnostic">Diagnostic</option>
                    <option value="reparation">Reparation</option>
                    <option value="travaux">Travaux</option>
                    <option value="controle">Controle</option>
                    <option value="urgence">Urgence</option>
                    <option value="livraison">Livraison</option>
                    <option value="autre">Autre</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Date et heure *</span>
                  <input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setField('scheduledAt', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Duree minutes</span>
                  <input
                    value={form.durationMinutes}
                    onChange={(e) => setField('durationMinutes', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="60"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm font-medium text-slate-700">Titre</span>
                  <input
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Passage diagnostic, reparation fuite..."
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                    className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Instructions pour le technicien..."
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
                  disabled={createIntervention.isPending}
                  className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                >
                  {createIntervention.isPending ? 'Creation...' : 'Creer intervention'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Chargement...</div>
        ) : filteredInterventions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold text-slate-900">Aucune intervention</p>
            <p className="mt-1 text-sm text-slate-500">
              Cree une intervention depuis un chantier et un technicien.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredInterventions.map((intervention) => (
              <div
                key={intervention.id}
                className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-start"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {intervention.title || intervention.chantierTitle || 'Intervention'}
                    </h3>

                    <span
                      className={
                        'rounded-full px-2 py-1 text-xs font-semibold ' +
                        statusClass(intervention.status)
                      }
                    >
                      {intervention.status}
                    </span>

                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {intervention.type}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {intervention.chantierReference} - {intervention.chantierTitle}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Client : {intervention.clientName ?? 'Non renseigne'}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Technicien : {intervention.technicianFirstName}{' '}
                    {intervention.technicianLastName}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Date : {formatDate(intervention.scheduledAt)} - {intervention.durationMinutes} min
                  </p>

                  {intervention.notes && (
                    <p className="mt-3 text-sm text-slate-600">{intervention.notes}</p>
                  )}

                  <div className="mt-3">
                    <Link
                      href={'/chantiers/' + intervention.chantierId}
                      className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      Ouvrir le chantier
                    </Link>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  {intervention.status === 'planifiee' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ id: intervention.id, status: 'en_cours' })
                      }
                      className="rounded-lg border border-orange-200 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-50"
                    >
                      Demarrer
                    </button>
                  )}

                  {intervention.status !== 'terminee' && intervention.status !== 'annulee' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ id: intervention.id, status: 'terminee' })
                      }
                      className="rounded-lg border border-green-200 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50"
                    >
                      Terminer
                    </button>
                  )}

                  {intervention.status !== 'annulee' && intervention.status !== 'terminee' && (
                    <button
                      type="button"
                      onClick={() =>
                        updateStatus.mutate({ id: intervention.id, status: 'annulee' })
                      }
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
`);

patchRoot();

console.log("Module interventions planning MVP complete.");
'@ | Set-Content "add-interventions-planning-mvp.js" -Encoding UTF8

Write-Host "Application du script Node..." -ForegroundColor Cyan
node .\add-interventions-planning-mvp.js

Write-Host "Suppression script temporaire..." -ForegroundColor Cyan
Remove-Item "add-interventions-planning-mvp.js" -Force -ErrorAction SilentlyContinue

Write-Host "Nettoyage cache Next/Turbo..." -ForegroundColor Cyan
Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Commit + push GitHub..." -ForegroundColor Cyan
git add .
git commit -m "add interventions planning mvp"
git push origin main

Write-Host ""
Write-Host "Module Interventions + Planning ajoute." -ForegroundColor Green
Write-Host "Relance : npm run dev" -ForegroundColor Green
Write-Host "Teste : http://localhost:3000/planning" -ForegroundColor Green
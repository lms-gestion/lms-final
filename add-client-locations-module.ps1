cd "C:\Users\Shoks\Desktop\lms-final"

Write-Host "Ajout module Lieux d'intervention..." -ForegroundColor Cyan

# 1. Router tRPC clientLocations
$RouterPath = "apps\web\lib\trpc\routers\client-locations.ts"

@'
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
'@ | Set-Content $RouterPath -Encoding UTF8

# 2. Patch root.ts
$RootPath = "apps\web\lib\trpc\root.ts"
$Root = Get-Content $RootPath -Raw

if ($Root -notmatch "clientLocationsRouter") {
  $Root = $Root -replace "import \{ agenciesRouter \} from './routers/agencies'", "import { agenciesRouter } from './routers/agencies'`nimport { clientLocationsRouter } from './routers/client-locations'"
  $Root = $Root -replace "agencies: agenciesRouter,", "agencies: agenciesRouter,`n  clientLocations: clientLocationsRouter,"
  Set-Content $RootPath $Root -Encoding UTF8
}

# 3. Composant UI
$Dir = "apps\web\app\(app)\clients\[id]"
New-Item -ItemType Directory -Force $Dir | Out-Null

$PanelPath = "$Dir\client-locations-panel.tsx"

@'
'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'

type Props = {
  clientId: string
}

export function ClientLocationsPanel({ clientId }: Props) {
  const utils = trpc.useUtils()

  const { data: locations = [], isLoading } = trpc.clientLocations.listByClient.useQuery({
    clientId,
  })

  const createLocation = trpc.clientLocations.create.useMutation({
    onSuccess: async () => {
      await utils.clientLocations.listByClient.invalidate({ clientId })
      setOpen(false)
      setForm(emptyForm)
    },
  })

  const archiveLocation = trpc.clientLocations.archive.useMutation({
    onSuccess: async () => {
      await utils.clientLocations.listByClient.invalidate({ clientId })
    },
  })

  const emptyForm = {
    name: '',
    internalCode: '',
    street: '',
    postalCode: '',
    city: '',
    yearBuilt: '',
    lotsCount: '',
    accessCode: '',
    accessNotes: '',
    notes: '',
  }

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  function updateField(key: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function submit() {
    if (!form.name.trim()) {
      alert('Nom du lieu requis')
      return
    }

    await createLocation.mutateAsync({
      clientId,
      name: form.name.trim(),
      internalCode: form.internalCode.trim() || undefined,
      address: {
        street: form.street.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
        city: form.city.trim() || undefined,
      },
      yearBuilt: form.yearBuilt ? Number(form.yearBuilt) : null,
      lotsCount: form.lotsCount ? Number(form.lotsCount) : null,
      accessCode: form.accessCode.trim() || undefined,
      accessNotes: form.accessNotes.trim() || undefined,
      notes: form.notes.trim() || undefined,
      tags: [],
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Lieux d’intervention</h2>
          <p className="text-sm text-slate-500">
            Résidences, bâtiments, accès, codes et informations utiles pour les interventions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {open ? 'Fermer' : '+ Nouveau lieu'}
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Créer un lieu</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Nom du lieu *</span>
              <input
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Résidence Les Jardins"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Code interne</span>
              <input
                value={form.internalCode}
                onChange={(e) => updateField('internalCode', e.target.value)}
                placeholder="RES-001"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Adresse</span>
              <input
                value={form.street}
                onChange={(e) => updateField('street', e.target.value)}
                placeholder="12 rue de la République"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Code postal</span>
              <input
                value={form.postalCode}
                onChange={(e) => updateField('postalCode', e.target.value)}
                placeholder="34000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Ville</span>
              <input
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="Montpellier"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Année construction</span>
              <input
                value={form.yearBuilt}
                onChange={(e) => updateField('yearBuilt', e.target.value)}
                placeholder="1998"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Nombre de lots</span>
              <input
                value={form.lotsCount}
                onChange={(e) => updateField('lotsCount', e.target.value)}
                placeholder="42"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Code accès</span>
              <input
                value={form.accessCode}
                onChange={(e) => updateField('accessCode', e.target.value)}
                placeholder="A1234"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">Notes accès</span>
              <input
                value={form.accessNotes}
                onChange={(e) => updateField('accessNotes', e.target.value)}
                placeholder="Badge chez le gardien"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Informations complémentaires"
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              disabled={createLocation.isPending}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {createLocation.isPending ? 'Création...' : 'Créer le lieu'}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Chargement des lieux...</div>
        ) : locations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-base font-medium text-slate-900">Aucun lieu enregistré</p>
            <p className="mt-1 text-sm text-slate-500">
              Ajoutez une résidence, un bâtiment ou une adresse d’intervention.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {locations.map((location) => {
              const address = location.address as
                | { street?: string; postalCode?: string; city?: string }
                | null

              return (
                <div key={location.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{location.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {[address?.street, address?.postalCode, address?.city]
                          .filter(Boolean)
                          .join(' · ') || 'Adresse non renseignée'}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        {location.internalCode && (
                          <span className="rounded-full bg-slate-100 px-2 py-1">
                            Code : {location.internalCode}
                          </span>
                        )}
                        {location.lotsCount && (
                          <span className="rounded-full bg-slate-100 px-2 py-1">
                            {location.lotsCount} lots
                          </span>
                        )}
                        {location.accessCode && (
                          <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">
                            Accès : {location.accessCode}
                          </span>
                        )}
                      </div>

                      {location.accessNotes && (
                        <p className="mt-3 text-sm text-slate-700">
                          Accès : {location.accessNotes}
                        </p>
                      )}

                      {location.notes && (
                        <p className="mt-2 text-sm text-slate-600">{location.notes}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => archiveLocation.mutate({ id: location.id })}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Archiver
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
'@ | Set-Content $PanelPath -Encoding UTF8

# 4. Page dédiée par client
$LocationsPageDir = "$Dir\locations"
New-Item -ItemType Directory -Force $LocationsPageDir | Out-Null

@'
import { notFound } from 'next/navigation'
import { ClientLocationsPanel } from '../client-locations-panel'

export default function ClientLocationsPage({ params }: { params: { id: string } }) {
  if (!params.id || params.id.length < 8) notFound()

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <ClientLocationsPanel clientId={params.id} />
    </div>
  )
}
'@ | Set-Content "$LocationsPageDir\page.tsx" -Encoding UTF8

# 5. Nettoyage cache
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item ".next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.next" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item ".turbo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "apps\web\.turbo" -Recurse -Force -ErrorAction SilentlyContinue

# 6. Git
git add .
git commit -m "add client locations module"
git push origin main

Write-Host ""
Write-Host "Module Lieux ajoute." -ForegroundColor Green
Write-Host "Relance : npm run dev" -ForegroundColor Green
Write-Host "Teste : http://localhost:3000/clients/ID_DU_CLIENT/locations" -ForegroundColor Green
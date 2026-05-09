'use client'

import Link from 'next/link'
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
                            Precedent
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
                            Suivant
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

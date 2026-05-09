'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { ChantierInterventions } from './chantier-interventions'

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

            <ChantierInterventions chantierId={id} />

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

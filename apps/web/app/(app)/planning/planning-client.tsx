'use client'

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

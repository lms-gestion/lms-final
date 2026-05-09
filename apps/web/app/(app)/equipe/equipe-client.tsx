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
                    {[technician.phone, technician.email].filter(Boolean).join(' Â· ') || 'Coordonnees non renseignees'}
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

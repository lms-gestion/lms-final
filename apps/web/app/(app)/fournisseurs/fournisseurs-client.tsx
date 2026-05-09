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
                    {[supplier.phone, supplier.email].filter(Boolean).join(' Â· ') || 'Coordonnees non renseignees'}
                  </p>

                  {supplier.primaryContactName && (
                    <p className="mt-1 text-sm text-slate-500">
                      Contact : {supplier.primaryContactName}
                      {supplier.primaryContactPhone ? ` Â· ${supplier.primaryContactPhone}` : ''}
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

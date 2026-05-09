'use client'

/**
 * Section "Interventions" intégrée à la fiche chantier.
 *
 * - Liste les interventions liées à ce chantier (à venir + historique)
 * - Création inline d'une nouvelle intervention (technicien, type, date, durée, notes)
 * - Changement de statut via menu déroulant (cohérent avec /planning)
 * - Le module /planning global reste inchangé
 *
 * Sécurité : passe par les routers tRPC (orgProcedure) qui font leurs propres
 * vérifications. Aucune lecture/écriture directe de Supabase ici.
 */

import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'

type Props = {
  chantierId: string
}

const TYPE_OPTIONS = [
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'reparation', label: 'Reparation' },
  { value: 'travaux', label: 'Travaux' },
  { value: 'controle', label: 'Controle' },
  { value: 'urgence', label: 'Urgence' },
  { value: 'livraison', label: 'Livraison' },
  { value: 'autre', label: 'Autre' },
] as const

const STATUS_OPTIONS = [
  { value: 'planifiee', label: 'Planifiee' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminee' },
  { value: 'annulee', label: 'Annulee' },
  { value: 'reportee', label: 'Reportee' },
] as const

type InterventionType = (typeof TYPE_OPTIONS)[number]['value']
type InterventionStatus = (typeof STATUS_OPTIONS)[number]['value']

const STATUS_BADGE: Record<InterventionStatus, string> = {
  planifiee: 'bg-blue-100 text-blue-800 border-blue-200',
  en_cours: 'bg-amber-100 text-amber-800 border-amber-200',
  terminee: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  annulee: 'bg-slate-200 text-slate-600 border-slate-300',
  reportee: 'bg-purple-100 text-purple-800 border-purple-200',
}

const TYPE_LABEL: Record<InterventionType, string> = {
  diagnostic: 'Diagnostic',
  reparation: 'Reparation',
  travaux: 'Travaux',
  controle: 'Controle',
  urgence: 'Urgence',
  livraison: 'Livraison',
  autre: 'Autre',
}

function defaultDatetimeLocal(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  now.setMinutes(0)
  return now.toISOString().slice(0, 16)
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ChantierInterventions({ chantierId }: Props) {
  const utils = trpc.useUtils()

  const [showForm, setShowForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [form, setForm] = useState({
    technicianId: '',
    type: 'reparation' as InterventionType,
    title: '',
    scheduledAt: defaultDatetimeLocal(),
    durationMinutes: '60',
    notes: '',
  })

  const { data: interventions = [], isLoading } = trpc.interventions.list.useQuery({ chantierId })
  const { data: selectors } = trpc.interventions.selectors.useQuery()

  const technicians = selectors?.technicians ?? []

  const createMutation = trpc.interventions.create.useMutation({
    onSuccess: async () => {
      await utils.interventions.list.invalidate({ chantierId })
      setForm({
        technicianId: '',
        type: 'reparation',
        title: '',
        scheduledAt: defaultDatetimeLocal(),
        durationMinutes: '60',
        notes: '',
      })
      setShowForm(false)
    },
  })

  const updateStatusMutation = trpc.interventions.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.interventions.list.invalidate({ chantierId })
    },
  })

  // Tri : à venir d'abord (planifiee, en_cours, reportee), puis terminees/annulees en historique
  const { active, history } = useMemo(() => {
    const now = Date.now()
    const a: typeof interventions = []
    const h: typeof interventions = []
    for (const i of interventions) {
      const isHistory =
        i.status === 'terminee' ||
        i.status === 'annulee' ||
        (i.status === 'planifiee' && new Date(i.scheduledAt).getTime() < now - 24 * 60 * 60 * 1000)
      if (isHistory) {
        h.push(i)
      } else {
        a.push(i)
      }
    }
    // Active : trie par date croissante (prochaine en haut)
    a.sort((x, y) => new Date(x.scheduledAt).getTime() - new Date(y.scheduledAt).getTime())
    // Historique : trie par date décroissante (plus récente en haut)
    h.sort((x, y) => new Date(y.scheduledAt).getTime() - new Date(x.scheduledAt).getTime())
    return { active: a, history: h }
  }, [interventions])

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((cur) => ({ ...cur, [key]: value }))
  }

  async function submit() {
    if (!form.technicianId) {
      alert('Technicien requis')
      return
    }

    const isoDate = new Date(form.scheduledAt).toISOString()

    await createMutation.mutateAsync({
      chantierId,
      technicianId: form.technicianId,
      type: form.type,
      title: form.title.trim() || undefined,
      scheduledAt: isoDate,
      durationMinutes: Number.parseInt(form.durationMinutes, 10) || 60,
      notes: form.notes.trim() || undefined,
    })
  }

  function changeStatus(id: string, status: InterventionStatus) {
    updateStatusMutation.mutate({ id, status })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Interventions</h2>
          <p className="text-xs text-slate-500">
            {active.length} a venir · {history.length} dans l&apos;historique
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          {showForm ? 'Annuler' : '+ Nouvelle intervention'}
        </button>
      </div>

      {/* Formulaire de création inline */}
      {showForm && (
        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Technicien *</span>
              <select
                value={form.technicianId}
                onChange={(e) => setField('technicianId', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">-- Choisir un technicien --</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                    {t.trades && t.trades.length > 0 ? ` (${t.trades.join(', ')})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Type</span>
              <select
                value={form.type}
                onChange={(e) => setField('type', e.target.value as InterventionType)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Date et heure *</span>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setField('scheduledAt', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Duree (min)</span>
              <input
                type="number"
                min={15}
                max={1440}
                step={15}
                value={form.durationMinutes}
                onChange={(e) => setField('durationMinutes', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Titre (optionnel)</span>
              <input
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="Ex : Remplacement chauffe-eau"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Notes (optionnel)</span>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Code d'acces, contact sur place, particularites..."
                className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={createMutation.isPending}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {createMutation.isPending ? 'Creation...' : 'Creer l\'intervention'}
            </button>
          </div>

          {createMutation.error && (
            <p className="mt-3 text-sm text-red-600">{createMutation.error.message}</p>
          )}
        </div>
      )}

      {/* Liste des interventions actives / a venir */}
      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : active.length === 0 && history.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Aucune intervention pour ce chantier.
          <br />
          Cliquez sur &quot;+ Nouvelle intervention&quot; pour en planifier une.
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                A venir / en cours
              </h3>
              {active.map((i) => (
                <InterventionRow
                  key={i.id}
                  intervention={i}
                  onChangeStatus={changeStatus}
                  pending={updateStatusMutation.isPending}
                />
              ))}
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700"
              >
                Historique ({history.length}) {showHistory ? '−' : '+'}
              </button>
              {showHistory && (
                <div className="mt-2 space-y-2">
                  {history.map((i) => (
                    <InterventionRow
                      key={i.id}
                      intervention={i}
                      onChangeStatus={changeStatus}
                      pending={updateStatusMutation.isPending}
                      historical
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {updateStatusMutation.error && (
        <p className="mt-3 text-sm text-red-600">{updateStatusMutation.error.message}</p>
      )}
    </div>
  )
}

type InterventionRowItem = {
  id: string
  type: InterventionType
  title: string | null
  scheduledAt: string | Date
  durationMinutes: number
  status: InterventionStatus
  notes: string | null
  technicianFirstName?: string | null
  technicianLastName?: string | null
}

function InterventionRow({
  intervention,
  onChangeStatus,
  pending,
  historical = false,
}: {
  intervention: InterventionRowItem
  onChangeStatus: (id: string, status: InterventionStatus) => void
  pending: boolean
  historical?: boolean
}) {
  const technicianName = [intervention.technicianFirstName, intervention.technicianLastName]
    .filter(Boolean)
    .join(' ') || 'Technicien inconnu'

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between ${
        historical ? 'bg-slate-50 opacity-90' : 'bg-white'
      }`}
    >
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
              STATUS_BADGE[intervention.status]
            }`}
          >
            {STATUS_OPTIONS.find((s) => s.value === intervention.status)?.label ?? intervention.status}
          </span>
          <span className="text-sm font-semibold text-slate-900">
            {TYPE_LABEL[intervention.type]}
          </span>
          {intervention.title && (
            <span className="text-sm text-slate-700">— {intervention.title}</span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {formatDateTime(intervention.scheduledAt)} · {intervention.durationMinutes} min
          {' · '}
          {technicianName}
        </div>
        {intervention.notes && (
          <p className="text-xs italic text-slate-600">{intervention.notes}</p>
        )}
      </div>

      <div className="md:w-48">
        <select
          value={intervention.status}
          onChange={(e) => onChangeStatus(intervention.id, e.target.value as InterventionStatus)}
          disabled={pending}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

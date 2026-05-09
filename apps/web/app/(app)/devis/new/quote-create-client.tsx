'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc/client'

type Props = {
  chantierId?: string
  clientId?: string
}

export function QuoteCreateClient({ chantierId, clientId: initialClientId }: Props) {
  const router = useRouter()
  const utils = trpc.useUtils()

  const { data: selectors } = trpc.quotes.selectors.useQuery()
  const { data: prefill } = trpc.quotes.prefillFromChantier.useQuery(
    chantierId ? { chantierId } : (undefined as never),
    { enabled: !!chantierId },
  )

  const [clientId, setClientId] = useState(initialClientId ?? '')
  const [chantierIdState, setChantierIdState] = useState(chantierId ?? '')
  const [subject, setSubject] = useState('')
  const [introText, setIntroText] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('Paiement a 30 jours fin de mois')
  const [validityDays, setValidityDays] = useState('30')
  const [acomptePct, setAcomptePct] = useState('')

  // Pre-remplissage depuis chantier
  useEffect(() => {
    if (prefill) {
      if (prefill.clientId) setClientId(prefill.clientId)
      if (prefill.chantierId) setChantierIdState(prefill.chantierId)
      if (prefill.subject) setSubject(prefill.subject)
      if (prefill.introText) setIntroText(prefill.introText)
    }
  }, [prefill])

  const createMutation = trpc.quotes.create.useMutation({
    onSuccess: async (quote) => {
      if (!quote) return
      await utils.quotes.list.invalidate()
      router.push(`/devis/${quote.id}`)
    },
  })

  async function handleCreate() {
    if (!clientId) {
      alert('Client requis')
      return
    }
    if (!subject.trim()) {
      alert('Objet requis')
      return
    }

    await createMutation.mutateAsync({
      clientId,
      chantierId: chantierIdState || undefined,
      subject: subject.trim(),
      introText: introText.trim() || undefined,
      paymentTerms: paymentTerms.trim() || undefined,
      validityDays: Number.parseInt(validityDays, 10) || 30,
      acomptePct: acomptePct ? Number.parseFloat(acomptePct) : undefined,
      lines: [],
    })
  }

  const filteredChantiers = clientId
    ? (selectors?.chantiers ?? []).filter((c) => c.clientId === clientId)
    : (selectors?.chantiers ?? [])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <Link href="/devis" className="text-sm text-slate-500 hover:text-slate-700">
          {'< Retour aux devis'}
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Nouveau devis</h1>
        <p className="mb-6 text-sm text-slate-500">
          Apres creation, vous pourrez ajouter et editer les lignes.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Client *
            </label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value)
                // Si client change, reset le chantier choisi
                if (e.target.value !== clientId) setChantierIdState('')
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">-- Choisir un client --</option>
              {selectors?.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Chantier lie (optionnel)
            </label>
            <select
              value={chantierIdState}
              onChange={(e) => setChantierIdState(e.target.value)}
              disabled={!clientId}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            >
              <option value="">{clientId ? '-- Aucun --' : 'Choisissez d\'abord un client'}</option>
              {filteredChantiers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference} - {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Objet du devis *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex : Refection plomberie salle de bain"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Texte d'introduction (optionnel)
            </label>
            <textarea
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              placeholder="Description courte du contexte ou de la prestation"
              className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Validite (jours)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Acompte (%) (optionnel)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={acomptePct}
                onChange={(e) => setAcomptePct(e.target.value)}
                placeholder="Ex : 30"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Conditions de paiement
            </label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {createMutation.error && (
          <p className="mt-4 text-sm text-red-600">{createMutation.error.message}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/devis"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            Annuler
          </Link>
          <button
            type="button"
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {createMutation.isPending ? 'Creation...' : 'Creer et editer les lignes'}
          </button>
        </div>
      </div>
    </div>
  )
}

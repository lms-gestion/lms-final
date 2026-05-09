'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'

const LINE_TYPES = ['item', 'section', 'subtotal', 'note'] as const
type LineType = (typeof LINE_TYPES)[number]

const STATUS_BADGE: Record<string, string> = {
  brouillon: 'bg-slate-100 text-slate-700 border-slate-200',
  envoye: 'bg-blue-100 text-blue-800 border-blue-200',
  consulte: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  accepte: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  refuse: 'bg-red-100 text-red-800 border-red-200',
  expire: 'bg-amber-100 text-amber-800 border-amber-200',
}

type Line = {
  type: LineType
  position: number
  description: string
  quantity: string
  unit: string
  unitPriceHt: string
  vatRate: string
  discountPct: string
}

const EMPTY_ITEM: Line = {
  type: 'item',
  position: 0,
  description: '',
  quantity: '1',
  unit: 'u',
  unitPriceHt: '0',
  vatRate: '20',
  discountPct: '0',
}

function makeEmptyLine(type: LineType, position: number): Line {
  return { ...EMPTY_ITEM, type, position }
}

function num(value: string): number {
  const n = Number.parseFloat((value ?? '').toString().replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function formatEur(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('fr-FR')
}

function lineTotalHt(l: Line): number {
  if (l.type !== 'item') return 0
  const qty = num(l.quantity)
  const pu = num(l.unitPriceHt)
  const disc = num(l.discountPct)
  return qty * pu * (1 - disc / 100)
}

export function QuoteDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const utils = trpc.useUtils()

  const { data, isLoading, error } = trpc.quotes.get.useQuery({ id })
  const { data: selectors } = trpc.quotes.selectors.useQuery()

  const [lines, setLines] = useState<Line[]>([])
  const [subject, setSubject] = useState('')
  const [introText, setIntroText] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [acomptePct, setAcomptePct] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [dirty, setDirty] = useState(false)

  // Hydrate state depuis le devis
  useEffect(() => {
    if (!data) return
    const q = data.quote
    setSubject(q.subject)
    setIntroText(q.introText ?? '')
    setPaymentTerms(q.paymentTerms ?? '')
    setAcomptePct(q.acomptePct ?? '')
    setExpiryDate(q.expiryDate ?? '')
    setLines(
      data.lines.map((l, idx) => ({
        type: (l.type as LineType) ?? 'item',
        position: l.position ?? idx,
        description: l.description ?? '',
        quantity: l.quantity ?? '0',
        unit: l.unit ?? 'u',
        unitPriceHt: l.unitPriceHt ?? '0',
        vatRate: l.vatRate ?? '20',
        discountPct: l.discountPct ?? '0',
      })),
    )
    setDirty(false)
  }, [data])

  const updateMutation = trpc.quotes.update.useMutation({
    onSuccess: async () => {
      await utils.quotes.get.invalidate({ id })
      await utils.quotes.list.invalidate()
      setDirty(false)
    },
  })

  const sendMutation = trpc.quotes.send.useMutation({
    onSuccess: async () => {
      await utils.quotes.get.invalidate({ id })
      await utils.quotes.list.invalidate()
    },
  })

  const changeStatusMutation = trpc.quotes.changeStatus.useMutation({
    onSuccess: async () => {
      await utils.quotes.get.invalidate({ id })
      await utils.quotes.list.invalidate()
    },
  })

  const deleteMutation = trpc.quotes.delete.useMutation({
    onSuccess: async () => {
      await utils.quotes.list.invalidate()
      router.push('/devis')
    },
  })

  // Totaux calcules en live
  const totals = useMemo(() => {
    let ht = 0
    let tva = 0
    const vatBreakdown: Record<string, { base: number; vat: number }> = {}

    for (const l of lines) {
      if (l.type !== 'item') continue
      const lineHt = lineTotalHt(l)
      const vat = num(l.vatRate)
      const lineTva = lineHt * (vat / 100)
      ht += lineHt
      tva += lineTva
      const key = vat.toFixed(1)
      vatBreakdown[key] = vatBreakdown[key] ?? { base: 0, vat: 0 }
      vatBreakdown[key]!.base += lineHt
      vatBreakdown[key]!.vat += lineTva
    }

    return { ht, tva, ttc: ht + tva, vatBreakdown }
  }, [lines])

  if (isLoading || !data) {
    return <p className="text-sm text-slate-500">Chargement...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">Erreur : {error.message}</p>
  }

  const quote = data.quote
  const isDraft = quote.status === 'brouillon'
  const isSent = ['envoye', 'consulte', 'accepte', 'refuse', 'expire'].includes(quote.status)

  function setLine(idx: number, updates: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...updates } : l)))
    setDirty(true)
  }

  function addLine(type: LineType) {
    setLines((prev) => [...prev, makeEmptyLine(type, prev.length)])
    setDirty(true)
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, position: i })))
    setDirty(true)
  }

  function moveLine(idx: number, direction: 'up' | 'down') {
    setLines((prev) => {
      const target = direction === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const tmp = next[idx]!
      next[idx] = next[target]!
      next[target] = tmp
      return next.map((l, i) => ({ ...l, position: i }))
    })
    setDirty(true)
  }

  async function save() {
    await updateMutation.mutateAsync({
      id,
      data: {
        subject: subject.trim(),
        introText: introText || undefined,
        paymentTerms: paymentTerms || undefined,
        acomptePct: acomptePct ? Number.parseFloat(acomptePct) : undefined,
        expiryDate: expiryDate || undefined,
        lines: lines.map((l, i) => ({
          type: l.type,
          position: i,
          description: l.description,
          quantity: l.type === 'item' ? num(l.quantity) : null,
          unit: l.type === 'item' ? l.unit : null,
          unitPriceHt: l.type === 'item' ? num(l.unitPriceHt) : null,
          vatRate: l.type === 'item' ? num(l.vatRate) : null,
          discountPct: l.type === 'item' ? num(l.discountPct) : null,
        })),
      },
    })
  }

  async function sendQuote() {
    if (dirty) {
      if (!confirm('Vous avez des modifications non enregistrees. Sauvegarder avant l\'envoi ?')) {
        return
      }
      await save()
    }
    if (
      !confirm(
        'Envoyer ce devis ? Une fois envoye, vous ne pourrez plus le modifier (creez un nouveau devis si besoin).',
      )
    ) {
      return
    }
    await sendMutation.mutateAsync({ id })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3"><Link href="/devis" className="text-sm text-slate-500 hover:text-slate-700">
          {'< Retour aux devis'}
        </Link>
        <Link href={`/devis/${id}/preview`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Apercu client</Link></div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase ${
              STATUS_BADGE[quote.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {quote.status}
          </span>
          {isDraft && (
            <>
              <button
                type="button"
                onClick={() => deleteMutation.mutate({ id })}
                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100:opacity-60"
              >
                Supprimer
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50:opacity-60"
              >
                {updateMutation.isPending ? 'Sauvegarde...' : dirty ? 'Sauvegarder' : 'Sauvegarde'}
              </button>
              <button
                type="button"
                onClick={sendQuote}
                className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600:opacity-60"
              >
                {sendMutation.isPending ? 'Envoi...' : 'Envoyer'}
              </button>
            </>
          )}
          {isSent && quote.status !== 'accepte' && quote.status !== 'refuse' && (
            <>
              <button
                type="button"
                onClick={() => {
                  const name = prompt('Nom de la personne qui accepte ?')
                  if (name) {
                    changeStatusMutation.mutate({ id, status: 'accepte', acceptedByName: name })
                  }
                }}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
              >
                Marquer accepte
              </button>
              <button
                type="button"
                onClick={() => {
                  const reason = prompt('Raison du refus (optionnel) :')
                  changeStatusMutation.mutate({
                    id,
                    status: 'refuse',
                    refusalReason: reason ?? undefined,
                  })
                }}
                className="rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
              >
                Marquer refuse
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">{quote.reference}</p>
            <h1 className="text-2xl font-bold text-slate-900">{quote.subject || 'Sans objet'}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Pour <strong>{quote.clientName}</strong>
              {quote.chantierReference && (
                <span className="ml-2 text-slate-500">
                  · Chantier {quote.chantierReference} - {quote.chantierTitle}
                </span>
              )}
            </p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <p>Emis le {formatDate(quote.issueDate)}</p>
            <p>Expire le {formatDate(quote.expiryDate)}</p>
            {quote.viewedCount > 0 && (
              <p className="text-emerald-600">Consulte {quote.viewedCount} fois</p>
            )}
            {quote.acceptedAt && (
              <p className="text-emerald-700">Accepte le {formatDate(quote.acceptedAt)}</p>
            )}
            {quote.refusedAt && (
              <p className="text-red-700">Refuse le {formatDate(quote.refusedAt)}</p>
            )}
          </div>
        </div>

        {/* Champs editables uniquement en brouillon */}
        {isDraft ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Objet</label>
              <input
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value)
                  setDirty(true)
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Introduction (optionnel)
              </label>
              <textarea
                value={introText}
                onChange={(e) => {
                  setIntroText(e.target.value)
                  setDirty(true)
                }}
                className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Date d'expiration
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => {
                  setExpiryDate(e.target.value)
                  setDirty(true)
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Acompte (%)
              </label>
              <input
                type="text" inputMode="decimal"
                min={0}
                max={100}
                value={acomptePct}
                onChange={(e) => {
                  setAcomptePct(e.target.value)
                  setDirty(true)
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Conditions de paiement
              </label>
              <input
                value={paymentTerms}
                onChange={(e) => {
                  setPaymentTerms(e.target.value)
                  setDirty(true)
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : (
          <>
            {introText && (
              <p className="mb-3 whitespace-pre-wrap text-sm text-slate-700">{introText}</p>
            )}
            <p className="text-sm text-slate-600">
              Conditions : {paymentTerms || 'Non precisees'}
              {acomptePct && ` · Acompte ${acomptePct}%`}
            </p>
          </>
        )}
      </div>

      {/* Editeur de lignes WYSIWYG */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Lignes</h2>
          {isDraft && (
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => addLine('item')}
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
              >
                + Article
              </button>
              <button
                type="button"
                onClick={() => addLine('section')}
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
              >
                + Section
              </button>
              <button
                type="button"
                onClick={() => addLine('note')}
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
              >
                + Note
              </button>
            </div>
          )}
        </div>

        {lines.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            Aucune ligne pour le moment.
            {isDraft && (
              <button
                type="button"
                onClick={() => addLine('item')}
                className="ml-2 font-semibold text-orange-600 hover:underline"
              >
                Ajouter un article
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/40 text-xs uppercase text-slate-500">
                <th className="w-12 px-2 py-2"></th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="w-20 px-2 py-2 text-right">Qte</th>
                <th className="w-20 px-2 py-2 text-left">Unite</th>
                <th className="w-28 px-2 py-2 text-right">PU HT</th>
                <th className="w-20 px-2 py-2 text-right">TVA %</th>
                <th className="w-20 px-2 py-2 text-right">Remise %</th>
                <th className="w-28 px-2 py-2 text-right">Total HT</th>
                {isDraft && <th className="w-12 px-2 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                if (line.type === 'section') {
                  return (
                    <tr key={idx} className="border-b border-slate-100 bg-slate-100/60">
                      <td className="px-2 py-2 text-center text-xs text-slate-500">§</td>
                      <td className="px-2 py-2" colSpan={isDraft ? 7 : 7}>
                        {isDraft ? (
                          <input
                            value={line.description}
                            onChange={(e) => setLine(idx, { description: e.target.value })}
                            placeholder="Titre de section (ex : PHASE 1 - Demolition)"
                            className="w-full bg-transparent font-bold uppercase text-slate-800 outline-none"
                          />
                        ) : (
                          <span className="font-bold uppercase">{line.description}</span>
                        )}
                      </td>
                      {isDraft && (
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            X
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                }
                if (line.type === 'note') {
                  return (
                    <tr key={idx} className="border-b border-slate-100 italic text-slate-500">
                      <td className="px-2 py-2 text-center text-xs">i</td>
                      <td className="px-2 py-2" colSpan={isDraft ? 7 : 7}>
                        {isDraft ? (
                          <input
                            value={line.description}
                            onChange={(e) => setLine(idx, { description: e.target.value })}
                            placeholder="Note libre..."
                            className="w-full bg-transparent italic outline-none"
                          />
                        ) : (
                          line.description
                        )}
                      </td>
                      {isDraft && (
                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            X
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                }
                // item
                return (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-center">
                      {isDraft && (
                        <div className="flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveLine(idx, 'up')}
                            className="text-xs text-slate-400 hover:text-slate-700:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLine(idx, 'down')}
                            className="text-xs text-slate-400 hover:text-slate-700:opacity-30"
                          >
                            ▼
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isDraft ? (
                        <textarea
                          value={line.description}
                          onChange={(e) => setLine(idx, { description: e.target.value })}
                          rows={1}
                          placeholder="Description de la prestation"
                          className="w-full resize-none border-0 bg-transparent outline-none focus:ring-0"
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">{line.description}</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {isDraft ? (
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => setLine(idx, { quantity: e.target.value })}
                          className="w-full bg-transparent text-right outline-none"
                        />
                      ) : (
                        line.quantity
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {isDraft ? (
                        <select
                          value={line.unit}
                          onChange={(e) => setLine(idx, { unit: e.target.value })}
                          className="w-full bg-transparent outline-none"
                        >
                          {(selectors?.lineUnits ?? ['u']).map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      ) : (
                        line.unit
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {isDraft ? (
                        <input
                          type="text" inputMode="decimal"
                          step="0.01"
                          value={line.unitPriceHt}
                          onChange={(e) => setLine(idx, { unitPriceHt: e.target.value })}
                          className="w-full bg-transparent text-right outline-none"
                        />
                      ) : (
                        formatEur(line.unitPriceHt)
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {isDraft ? (
                        <select
                          value={line.vatRate}
                          onChange={(e) => setLine(idx, { vatRate: e.target.value })}
                          className="w-full bg-transparent text-right outline-none"
                        >
                          {(selectors?.vatRates ?? [20]).map((r) => (
                            <option key={r} value={r}>
                              {r}%
                            </option>
                          ))}
                        </select>
                      ) : (
                        `${line.vatRate}%`
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {isDraft ? (
                        <input
                          type="text" inputMode="decimal"
                          step="1"
                          value={line.discountPct}
                          onChange={(e) => setLine(idx, { discountPct: e.target.value })}
                          className="w-full bg-transparent text-right outline-none"
                        />
                      ) : (
                        `${line.discountPct}%`
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">
                      {formatEur(lineTotalHt(line))}
                    </td>
                    {isDraft && (
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          X
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Totaux */}
      <div className="mb-6 ml-auto max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Sous-total HT</span>
            <span className="font-semibold">{formatEur(totals.ht)}</span>
          </div>
          {Object.entries(totals.vatBreakdown).map(([rate, b]) => (
            <div key={rate} className="flex items-center justify-between text-xs text-slate-500">
              <span>TVA {rate}% sur {formatEur(b.base)}</span>
              <span>{formatEur(b.vat)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
            <span>Total TTC</span>
            <span>{formatEur(totals.ttc)}</span>
          </div>
          {acomptePct && Number.parseFloat(acomptePct) > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm text-orange-600">
              <span>Acompte {acomptePct}% a la signature</span>
              <span>{formatEur((totals.ttc * Number.parseFloat(acomptePct)) / 100)}</span>
            </div>
          )}
        </div>
      </div>

      {dirty && isDraft && (
        <div className="sticky bottom-4 ml-auto max-w-md rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800 shadow-md">
          Modifications non enregistrees.{' '}
          <button
            type="button"
            onClick={save}
            className="ml-2 font-semibold underline hover:text-orange-900"
          >
            {updateMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder maintenant'}
          </button>
        </div>
      )}

      {updateMutation.error && (
        <p className="mt-3 text-sm text-red-600">{updateMutation.error.message}</p>
      )}
      {sendMutation.error && (
        <p className="mt-3 text-sm text-red-600">{sendMutation.error.message}</p>
      )}
    </div>
  )
}

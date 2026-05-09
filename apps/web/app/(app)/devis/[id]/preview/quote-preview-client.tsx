'use client'

import Link from 'next/link'
import { trpc } from '@/lib/trpc/client'

function eur(value: unknown) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(n) ? n : 0)
}

function dateFr(value: unknown) {
  if (!value) return '-'
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('fr-FR')
}

export function QuotePreviewClient({ id }: { id: string }) {
  const { data, isLoading, error } = trpc.quotes.get.useQuery({ id })

  if (isLoading) return <div className="p-8">Chargement du devis...</div>
  if (error || !data?.quote) return <div className="p-8 text-red-600">Devis introuvable.</div>

  const quote = data.quote
  const lines = data.lines ?? []

  return (
    <div className="min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl justify-between print:hidden">
        <Link href={'/devis/' + id} className="text-sm font-medium text-slate-600">
          Retour edition
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Imprimer / PDF
        </button>
      </div>

      <main className="mx-auto max-w-4xl bg-white p-10 shadow print:max-w-none print:p-8 print:shadow-none">
        <div className="mb-10 flex justify-between gap-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">DEVIS</h1>
            <p className="mt-2 text-sm text-slate-500">Reference : {quote.reference}</p>
            <p className="text-sm text-slate-500">Date : {dateFr(quote.issueDate)}</p>
            <p className="text-sm text-slate-500">Valable jusqu'au : {dateFr(quote.expiryDate)}</p>
          </div>

          <div className="text-right">
            <p className="text-xl font-bold text-slate-900">La Maison des Services</p>
            <p className="mt-2 text-sm text-slate-600">420 avenue Blaise Pascal</p>
            <p className="text-sm text-slate-600">34170 Castelnau-le-Lez</p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-8">
          <div className="rounded-lg border border-slate-200 p-4">
            <h2 className="mb-3 text-xs font-bold uppercase text-slate-500">Client</h2>
            <p className="font-semibold text-slate-900">{quote.clientName ?? 'Client'}</p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h2 className="mb-3 text-xs font-bold uppercase text-slate-500">Objet</h2>
            <p className="font-semibold text-slate-900">{quote.subject}</p>
          </div>
        </div>

        {quote.introText && (
          <p className="mb-8 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {quote.introText}
          </p>
        )}

        <table className="mb-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="py-3 text-left">Designation</th>
              <th className="px-2 py-3 text-right">Qte</th>
              <th className="px-2 py-3 text-left">Unite</th>
              <th className="px-2 py-3 text-right">PU HT</th>
              <th className="px-2 py-3 text-right">TVA</th>
              <th className="py-3 text-right">Total HT</th>
            </tr>
          </thead>

          <tbody>
            {lines.map((line: any) => {
              if (line.type === 'section') {
                return (
                  <tr key={line.id} className="border-b bg-slate-100">
                    <td colSpan={6} className="py-3 font-bold uppercase">
                      {line.description}
                    </td>
                  </tr>
                )
              }

              if (line.type === 'note') {
                return (
                  <tr key={line.id} className="border-b">
                    <td colSpan={6} className="py-3 italic text-slate-600">
                      {line.description}
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={line.id} className="border-b">
                  <td className="py-3">{line.description}</td>
                  <td className="px-2 py-3 text-right">{line.quantity}</td>
                  <td className="px-2 py-3">{line.unit}</td>
                  <td className="px-2 py-3 text-right">{eur(line.unitPriceHt)}</td>
                  <td className="px-2 py-3 text-right">{line.vatRate}%</td>
                  <td className="py-3 text-right font-semibold">{eur(line.totalHt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="ml-auto mb-10 w-80 rounded-lg border border-slate-200 p-4 text-sm">
          <div className="flex justify-between">
            <span>Total HT</span>
            <span className="font-semibold">{eur(quote.totalHt)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span>TVA</span>
            <span className="font-semibold">{eur(quote.totalTva)}</span>
          </div>
          <div className="mt-3 border-t pt-3 flex justify-between text-lg font-bold">
            <span>Total TTC</span>
            <span>{eur(quote.totalTtc)}</span>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-8">
          <div className="rounded-lg border border-slate-200 p-4">
            <h2 className="mb-8 text-xs font-bold uppercase text-slate-500">Bon pour accord</h2>
            <p className="text-sm text-slate-600">Nom, date et signature du client :</p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h2 className="mb-8 text-xs font-bold uppercase text-slate-500">Signature entreprise</h2>
            <p className="text-sm text-slate-600">La Maison des Services</p>
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

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

function lineTotal(line: any) {
  const qty = Number(line.quantity ?? 0)
  const pu = Number(line.unitPriceHt ?? 0)
  const discount = Number(line.discountPct ?? 0)
  const total = qty * pu * (1 - discount / 100)
  return Number.isFinite(total) ? total : 0
}

export function PublicDevisClient({ id }: { id: string }) {
  const { data, isLoading, error } = trpc.quotes.get.useQuery({ id })

  if (isLoading) {
    return <div className="min-h-screen bg-white p-10 text-slate-600">Chargement du devis...</div>
  }

  if (error || !data?.quote) {
    return <div className="min-h-screen bg-white p-10 text-red-600">Devis introuvable.</div>
  }

  const quote = data.quote
  const lines = data.lines ?? []

  return (
    <main className="min-h-screen bg-[#f3f4f6] px-6 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-5xl justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-[#f97316] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[#ea580c]"
        >
          Imprimer / enregistrer PDF
        </button>
      </div>

      <section className="mx-auto max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="h-4 bg-[#f97316]" />

        <div className="p-10 print:p-8">
          <header className="mb-10 flex items-start justify-between gap-10 border-b border-slate-200 pb-8">
            <div>
              <div className="inline-block rounded-2xl bg-slate-950 px-7 py-5">
                <p className="text-2xl font-black leading-none text-white">LA MAISON</p>
                <p className="mt-1 text-2xl font-black leading-none text-[#f97316]">DES SERVICES</p>
              </div>

              <div className="mt-5 text-sm leading-6 text-slate-700">
                <p className="font-extrabold text-slate-950">La Maison des Services</p>
                <p>420 avenue Blaise Pascal</p>
                <p>34170 Castelnau-le-Lez</p>
                <p>SIRET : 99140452600014</p>
                <p>TVA intra : FR75991404526</p>
                <p>https://lamaisondesservices.fr</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f97316]">
                Document
              </p>
              <h1 className="mt-2 text-5xl font-black tracking-tight text-slate-950">
                DEVIS
              </h1>

              <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-slate-800">
                <p><span className="font-bold">Reference :</span> {quote.reference}</p>
                <p><span className="font-bold">Date :</span> {dateFr(quote.issueDate)}</p>
                <p><span className="font-bold">Validite :</span> {dateFr(quote.expiryDate)}</p>
              </div>
            </div>
          </header>

          <section className="mb-8 grid grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 p-5">
              <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-[#f97316]">
                Emetteur
              </h2>
              <p className="font-bold text-slate-950">La Maison des Services</p>
              <p className="mt-1 text-sm text-slate-600">SIRET : 99140452600014</p>
              <p className="text-sm text-slate-600">TVA intra : FR75991404526</p>
              <p className="text-sm text-slate-600">Site : lamaisondesservices.fr</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h2 className="mb-3 text-xs font-black uppercase tracking-wide text-[#f97316]">
                Client
              </h2>
              <p className="font-bold text-slate-950">{quote.clientName ?? 'Client'}</p>
              {quote.clientLegalName && (
                <p className="text-sm text-slate-600">{quote.clientLegalName}</p>
              )}
            </div>
          </section>

          <section className="mb-8 rounded-xl border-l-4 border-[#f97316] bg-slate-50 p-5">
            <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-[#f97316]">
              Objet
            </h2>
            <p className="font-semibold text-slate-950">{quote.subject}</p>
          </section>

          {quote.introText && (
            <section className="mb-8">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {quote.introText}
              </p>
            </section>
          )}

          <section className="mb-8">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950 text-white">
                  <th className="rounded-l-lg px-3 py-3 text-left">Designation</th>
                  <th className="px-3 py-3 text-right">Qte</th>
                  <th className="px-3 py-3 text-left">Unite</th>
                  <th className="px-3 py-3 text-right">PU HT</th>
                  <th className="px-3 py-3 text-right">TVA</th>
                  <th className="rounded-r-lg px-3 py-3 text-right">Total HT</th>
                </tr>
              </thead>

              <tbody>
                {lines.map((line: any) => {
                  if (line.type === 'section') {
                    return (
                      <tr key={line.id} className="border-b bg-orange-50">
                        <td colSpan={6} className="px-3 py-3 font-black uppercase text-[#ea580c]">
                          {line.description}
                        </td>
                      </tr>
                    )
                  }

                  if (line.type === 'note') {
                    return (
                      <tr key={line.id} className="border-b border-slate-100">
                        <td colSpan={6} className="px-3 py-3 italic text-slate-600">
                          {line.description}
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 text-slate-800">{line.description}</td>
                      <td className="px-3 py-3 text-right">{line.quantity}</td>
                      <td className="px-3 py-3">{line.unit}</td>
                      <td className="px-3 py-3 text-right">{eur(line.unitPriceHt)}</td>
                      <td className="px-3 py-3 text-right">{line.vatRate}%</td>
                      <td className="px-3 py-3 text-right font-bold">
                        {eur(line.totalHt ?? lineTotal(line))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="ml-auto mb-10 w-80 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
            <div className="flex justify-between">
              <span>Total HT</span>
              <span className="font-bold">{eur(quote.totalHt)}</span>
            </div>

            <div className="mt-2 flex justify-between">
              <span>TVA</span>
              <span className="font-bold">{eur(quote.totalTva)}</span>
            </div>

            <div className="mt-4 border-t border-slate-300 pt-4">
              <div className="flex justify-between text-xl font-black text-[#f97316]">
                <span>Total TTC</span>
                <span>{eur(quote.totalTtc)}</span>
              </div>
            </div>
          </section>

          {quote.paymentTerms && (
            <section className="mb-8 rounded-xl border border-slate-200 p-5">
              <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-[#f97316]">
                Conditions de paiement
              </h2>
              <p className="text-sm text-slate-700">{quote.paymentTerms}</p>
            </section>
          )}

          <section className="mt-12 grid grid-cols-2 gap-8">
            <div className="rounded-xl border border-slate-200 p-5">
              <h2 className="mb-12 text-xs font-black uppercase tracking-wide text-[#f97316]">
                Bon pour accord
              </h2>
              <p className="text-sm text-slate-600">Nom, date, cachet et signature du client :</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-5">
              <h2 className="mb-12 text-xs font-black uppercase tracking-wide text-[#f97316]">
                Signature entreprise
              </h2>
              <p className="text-sm font-semibold text-slate-950">La Maison des Services</p>
            </div>
          </section>

          <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-xs leading-5 text-slate-500">
            La Maison des Services - 420 avenue Blaise Pascal, 34170 Castelnau-le-Lez<br />
            SIRET : 99140452600014 - TVA intra : FR75991404526 - https://lamaisondesservices.fr
          </footer>
        </div>
      </section>
    </main>
  )
}

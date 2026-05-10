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
    <main className="min-h-screen bg-[#f6f2ec] px-6 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-5xl justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-[#f97316] px-5 py-2 text-sm font-black text-white shadow hover:bg-[#ea580c]"
        >
          Imprimer / enregistrer PDF
        </button>
      </div>

      <section className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rotate-[-24deg] text-[180px] font-black tracking-[0.18em] text-slate-900/5 print:text-slate-900/5">
            DEVIS
          </div>
        </div>

        <div className="relative h-5 bg-[#f97316]" />

        <div className="relative p-10 print:p-8">
          <header className="mb-10 grid grid-cols-[1.2fr_0.8fr] gap-10 border-b border-slate-200 pb-8">
            <div>
              <div className="inline-flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                  <img
                    src="/img/logo-lms-icon.svg"
                    alt="La Maison des Services"
                    className="h-20 w-20 object-contain"
                  />
                </div>
                <div>
                  <p className="text-3xl font-black leading-none tracking-tight text-[#0f172a]">
                    La Maison
                  </p>
                  <p className="mt-1 text-3xl font-black leading-none tracking-tight text-[#f97316]">
                    des Services
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f97316]">
                Document
              </p>
              <h1 className="mt-2 text-6xl font-black tracking-tight text-[#0f172a]">
                DEVIS
              </h1>

              <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-slate-800">
                <p><span className="font-black">Reference :</span> {quote.reference}</p>
                <p><span className="font-black">Date :</span> {dateFr(quote.issueDate)}</p>
                <p><span className="font-black">Validite :</span> {dateFr(quote.expiryDate)}</p>
              </div>
            </div>
          </header>

          <section className="mb-8 grid grid-cols-2 gap-6">
            <div className="rounded-3xl border border-slate-200 bg-[#fbfaf8] p-6">
              <h2 className="mb-4 text-xs font-black uppercase tracking-wide text-[#f97316]">
                Emetteur
              </h2>
              <p className="font-black text-[#0f172a]">La Maison des Services</p>
              <div className="mt-2 text-sm leading-6 text-slate-700">
                <p>420 avenue Blaise Pascal</p>
                <p>34170 Castelnau-le-Lez</p>
                <p>04 65 84 15 94</p>
                <p>devis@lamaisondesservices.fr</p>
                <p>https://lamaisondesservices.fr</p>
                <p>SIRET : 99140452600014</p>
                <p>TVA intra : FR75991404526</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-[#fbfaf8] p-6">
              <h2 className="mb-4 text-xs font-black uppercase tracking-wide text-[#f97316]">
                Client
              </h2>
              <p className="font-black text-[#0f172a]">{quote.clientName ?? 'Client'}</p>
              {quote.clientLegalName && (
                <p className="mt-1 text-sm text-slate-600">{quote.clientLegalName}</p>
              )}
            </div>
          </section>

          <section className="mb-8 rounded-3xl border-l-8 border-[#f97316] bg-[#0f172a] p-6 text-white">
            <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-[#fb923c]">
              Objet du devis
            </h2>
            <p className="text-lg font-bold">{quote.subject}</p>
          </section>

          {quote.introText && (
            <section className="mb-8">
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {quote.introText}
              </p>
            </section>
          )}

          <section className="mb-8 overflow-hidden rounded-3xl border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#0f172a] text-white">
                  <th className="px-4 py-4 text-left">Designation</th>
                  <th className="px-3 py-4 text-right">Qte</th>
                  <th className="px-3 py-4 text-left">Unite</th>
                  <th className="px-3 py-4 text-right">PU HT</th>
                  <th className="px-3 py-4 text-right">TVA</th>
                  <th className="px-4 py-4 text-right">Total HT</th>
                </tr>
              </thead>

              <tbody>
                {lines.map((line: any) => {
                  if (line.type === 'section') {
                    return (
                      <tr key={line.id} className="border-b bg-orange-50">
                        <td colSpan={6} className="px-4 py-4 font-black uppercase text-[#ea580c]">
                          {line.description}
                        </td>
                      </tr>
                    )
                  }

                  if (line.type === 'note') {
                    return (
                      <tr key={line.id} className="border-b border-slate-100">
                        <td colSpan={6} className="px-4 py-4 italic text-slate-600">
                          {line.description}
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="px-4 py-4 text-slate-800">{line.description}</td>
                      <td className="px-3 py-4 text-right">{line.quantity}</td>
                      <td className="px-3 py-4">{line.unit}</td>
                      <td className="px-3 py-4 text-right">{eur(line.unitPriceHt)}</td>
                      <td className="px-3 py-4 text-right">{line.vatRate}%</td>
                      <td className="px-4 py-4 text-right font-black">
                        {eur(line.totalHt ?? lineTotal(line))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="ml-auto mb-10 w-96 rounded-3xl bg-[#0f172a] p-6 text-sm text-white">
            <div className="flex justify-between">
              <span>Total HT</span>
              <span className="font-bold">{eur(quote.totalHt)}</span>
            </div>

            <div className="mt-2 flex justify-between">
              <span>TVA</span>
              <span className="font-bold">{eur(quote.totalTva)}</span>
            </div>

            <div className="mt-5 border-t border-white/20 pt-5">
              <div className="flex justify-between text-2xl font-black text-[#f97316]">
                <span>Total TTC</span>
                <span>{eur(quote.totalTtc)}</span>
              </div>
            </div>
          </section>

          {quote.paymentTerms && (
            <section className="mb-8 rounded-3xl border border-slate-200 bg-[#fbfaf8] p-6">
              <h2 className="mb-2 text-xs font-black uppercase tracking-wide text-[#f97316]">
                Conditions de paiement
              </h2>
              <p className="text-sm text-slate-700">{quote.paymentTerms}</p>
            </section>
          )}

          <section className="mt-12 rounded-3xl border border-slate-200 bg-[#fbfaf8] p-6">
            <h2 className="mb-12 text-xs font-black uppercase tracking-wide text-[#f97316]">
              Bon pour accord
            </h2>
            <p className="text-sm text-slate-600">Nom, date, cachet et signature du client :</p>
          </section>

          <footer className="mt-10 border-t border-slate-200 pt-5 text-center text-xs leading-5 text-slate-500">
            La Maison des Services - 420 avenue Blaise Pascal, 34170 Castelnau-le-Lez<br />
            04 65 84 15 94 - devis@lamaisondesservices.fr - https://lamaisondesservices.fr<br />
            SIRET : 99140452600014 - TVA intra : FR75991404526
          </footer>
        </div>
      </section>
    </main>
  )
}

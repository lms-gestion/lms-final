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
    return <div className="min-h-screen bg-white p-8 text-slate-600">Chargement du devis...</div>
  }

  if (error || !data?.quote) {
    return <div className="min-h-screen bg-white p-8 text-red-600">Devis introuvable.</div>
  }

  const quote = data.quote
  const lines = data.lines ?? []

  return (
    <main className="min-h-screen bg-[#f5f2ec] px-4 py-5 print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex max-w-5xl justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-[#f97316] px-4 py-2 text-xs font-black text-white shadow hover:bg-[#ea580c]"
        >
          Imprimer / PDF
        </button>
      </div>

      <section className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none">
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 rotate-[-22deg] text-[150px] font-black tracking-[0.18em] text-[#111827]/[0.035] print:text-[#111827]/[0.035]">
            DEVIS
          </div>
        </div>

        <div className="relative h-3 bg-[#f97316]" />

        <div className="relative p-7 print:p-6">
          <header className="mb-5 grid grid-cols-[1fr_1.25fr] gap-5 border-b border-slate-200 pb-5">
            <section>
              <div className="flex items-center gap-3">
                <img
                  src="/img/logo-lms-icon.svg"
                  alt="La Maison des Services"
                  className="h-16 w-16 object-contain"
                />

                <div>
                  <p className="text-2xl font-black leading-none text-[#111827]">La Maison</p>
                  <p className="mt-1 text-2xl font-black leading-none text-[#f97316]">des Services</p>
                </div>
              </div>

              <div className="mt-3 text-[11px] leading-5 text-slate-700">
                <p className="font-black text-[#111827]">La Maison des Services</p>
                <p>420 avenue Blaise Pascal · 34170 Castelnau-le-Lez</p>
                <p>04 65 84 15 94 · devis@lamaisondesservices.fr</p>
                <p>lamaisondesservices.fr</p>
                <p>SIRET : 99140452600014 · TVA intra : FR75991404526</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-[#fbfaf7] p-4">
              <div className="mb-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f97316]">Document</p>
                <h1 className="text-4xl font-black leading-none text-[#111827]">DEVIS</h1>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-slate-200 pt-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#f97316]">Client</p>
                  <p className="mt-1 text-sm font-black text-[#111827]">{quote.clientName ?? 'Client'}</p>
                  {quote.clientLegalName && (
                    <p className="text-xs text-slate-600">{quote.clientLegalName}</p>
                  )}
                </div>

                <div className="text-right text-[11px] leading-5 text-slate-700">
                  <p><span className="font-black">Ref :</span> {quote.reference}</p>
                  <p><span className="font-black">Date :</span> {dateFr(quote.issueDate)}</p>
                  <p><span className="font-black">Validite :</span> {dateFr(quote.expiryDate)}</p>
                </div>
              </div>
            </section>
          </header>

          <section className="mb-4 rounded-2xl border-l-4 border-[#f97316] bg-[#111827] px-4 py-3 text-white">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#fb923c]">Objet</p>
            <p className="mt-1 text-sm font-bold">{quote.subject}</p>
          </section>

          {quote.introText && (
            <section className="mb-4">
              <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{quote.introText}</p>
            </section>
          )}

          <section className="mb-4 overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#111827] text-white">
                  <th className="px-3 py-2.5 text-left">Designation</th>
                  <th className="px-2 py-2.5 text-right">Qte</th>
                  <th className="px-2 py-2.5 text-left">Unite</th>
                  <th className="px-2 py-2.5 text-right">PU HT</th>
                  <th className="px-2 py-2.5 text-right">TVA</th>
                  <th className="px-3 py-2.5 text-right">Total HT</th>
                </tr>
              </thead>

              <tbody>
                {lines.map((line: any) => {
                  if (line.type === 'section') {
                    return (
                      <tr key={line.id} className="border-b bg-orange-50">
                        <td colSpan={6} className="px-3 py-2 font-black uppercase text-[#ea580c]">
                          {line.description}
                        </td>
                      </tr>
                    )
                  }

                  if (line.type === 'note') {
                    return (
                      <tr key={line.id} className="border-b border-slate-100">
                        <td colSpan={6} className="px-3 py-2 italic text-slate-600">
                          {line.description}
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 leading-5 text-slate-800">{line.description}</td>
                      <td className="px-2 py-2 text-right">{line.quantity}</td>
                      <td className="px-2 py-2">{line.unit}</td>
                      <td className="px-2 py-2 text-right">{eur(line.unitPriceHt)}</td>
                      <td className="px-2 py-2 text-right">{line.vatRate}%</td>
                      <td className="px-3 py-2 text-right font-black">
                        {eur(line.totalHt ?? lineTotal(line))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="mb-4 flex items-start justify-between gap-5">
            <div className="min-h-[88px] flex-1 rounded-2xl border border-slate-200 bg-[#fbfaf7] p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#f97316]">Bon pour accord</p>
              <p className="mt-8 text-xs text-slate-600">Nom, date, cachet et signature du client :</p>
            </div>

            <div className="w-80 rounded-2xl bg-[#111827] p-4 text-xs text-white">
              <div className="flex justify-between">
                <span>Total HT</span>
                <span className="font-bold">{eur(quote.totalHt)}</span>
              </div>

              <div className="mt-1.5 flex justify-between">
                <span>TVA</span>
                <span className="font-bold">{eur(quote.totalTva)}</span>
              </div>

              <div className="mt-3 border-t border-white/20 pt-3">
                <div className="flex justify-between text-lg font-black text-[#f97316]">
                  <span>Total TTC</span>
                  <span>{eur(quote.totalTtc)}</span>
                </div>
              </div>
            </div>
          </section>

          {quote.paymentTerms && (
            <section className="mb-4 rounded-2xl border border-slate-200 bg-[#fbfaf7] p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#f97316]">Conditions de paiement</p>
              <p className="mt-1 text-xs text-slate-700">{quote.paymentTerms}</p>
            </section>
          )}

          <footer className="border-t border-slate-200 pt-3 text-center text-[10px] leading-4 text-slate-500">
            La Maison des Services · 420 avenue Blaise Pascal, 34170 Castelnau-le-Lez · 04 65 84 15 94<br />
            devis@lamaisondesservices.fr · lamaisondesservices.fr · SIRET : 99140452600014 · TVA : FR75991404526
          </footer>
        </div>
      </section>
    </main>
  )
}

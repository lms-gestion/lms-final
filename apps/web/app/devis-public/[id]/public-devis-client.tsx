'use client'

import { trpc } from '@/lib/trpc/client'

type Address = {
  street?: string
  postalCode?: string
  city?: string
  country?: string
}

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

function addressLines(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const address = value as Address
  const cityLine = [address.postalCode, address.city].filter(Boolean).join(' ')
  return [address.street, cityLine, address.country].filter(Boolean) as string[]
}

export function PublicDevisClient({ id }: { id: string }) {
  const { data, isLoading, error } = trpc.quotes.getPublic.useQuery({ id })

  if (isLoading) {
    return <div className="min-h-screen bg-white p-8 text-slate-600">Chargement du devis...</div>
  }

  if (error || !data?.quote) {
    return <div className="min-h-screen bg-white p-8 text-red-600">Devis introuvable.</div>
  }

  const quote = data.quote
  const lines = data.lines ?? []
  const clientAddress = addressLines(quote.clientAddress)

  return (
    <main className="min-h-screen bg-[#f7f3ed] px-4 py-4 text-[#111827] print:min-h-0 print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex max-w-[920px] justify-end print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-[#f97316] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#ea580c]"
        >
          Imprimer / PDF
        </button>
      </div>

      <section className="relative mx-auto max-w-[920px] overflow-hidden rounded-lg bg-white shadow-lg print:max-w-none print:rounded-none print:shadow-none">
        <div className="pointer-events-none absolute inset-0 select-none">
          <div className="absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 rotate-[-22deg] text-[120px] font-black tracking-[0.18em] text-[#111827]/[0.035] print:text-[#111827]/[0.04]">
            DEVIS
          </div>
        </div>

        <div className="relative h-2 bg-[#f97316]" />

        <div className="relative p-5 print:p-4">
          <header className="mb-4 grid gap-4 border-b border-slate-200 pb-4 md:grid-cols-[1fr_1.2fr]">
            <section>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/img/logo-lms-icon.svg"
                alt="La Maison des Services"
                className="h-14 w-14 object-contain"
                onError={(event) => {
                  event.currentTarget.src =
                    'https://www.lamaisondesservices.fr/img/logo-lms-icon.svg'
                }}
              />

              <div className="mt-2 text-[10.5px] leading-4 text-slate-700">
                <p className="text-xs font-black text-[#111827]">La Maison des Services</p>
                <p>420 avenue Blaise Pascal</p>
                <p>34170 Castelnau-le-Lez</p>
                <p>04 65 84 15 94</p>
                <p>devis@lamaisondesservices.fr</p>
                <p>https://lamaisondesservices.fr</p>
                <p>SIRET : 99140452600014</p>
                <p>TVA intra : FR75991404526</p>
              </div>
            </section>

            <section>
              <div className="mb-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f97316]">
                  Document
                </p>
                <h1 className="text-4xl font-black leading-none text-[#111827]">DEVIS</h1>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-[#fbfaf7] p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#f97316]">
                    Client
                  </p>
                  <p className="mt-1 text-sm font-black text-[#111827]">
                    {quote.clientName ?? 'Client'}
                  </p>
                  {quote.clientLegalName && (
                    <p className="text-[11px] text-slate-600">{quote.clientLegalName}</p>
                  )}
                  {clientAddress.map((line) => (
                    <p key={line} className="text-[11px] text-slate-600">
                      {line}
                    </p>
                  ))}
                  {quote.clientEmail && (
                    <p className="text-[11px] text-slate-600">{quote.clientEmail}</p>
                  )}
                  {quote.clientPhone && (
                    <p className="text-[11px] text-slate-600">{quote.clientPhone}</p>
                  )}
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-700">
                  <p>
                    <span className="font-black text-[#111827]">Ref :</span> {quote.reference}
                  </p>
                  <p>
                    <span className="font-black text-[#111827]">Date :</span>{' '}
                    {dateFr(quote.issueDate)}
                  </p>
                  <p>
                    <span className="font-black text-[#111827]">Validite :</span>{' '}
                    {dateFr(quote.expiryDate)}
                  </p>
                  {quote.chantierReference && (
                    <p>
                      <span className="font-black text-[#111827]">Chantier :</span>{' '}
                      {quote.chantierReference}
                      {quote.chantierTitle ? ` - ${quote.chantierTitle}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </header>

          <section className="mb-3 border-l-4 border-[#f97316] bg-[#111827] px-3 py-2 text-white">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#fb923c]">Objet</p>
            <p className="mt-0.5 text-sm font-bold">{quote.subject}</p>
          </section>

          {quote.introText && (
            <section className="mb-3">
              <p className="whitespace-pre-wrap text-[11px] leading-4 text-slate-700">
                {quote.introText}
              </p>
            </section>
          )}

          <section className="mb-3 overflow-hidden rounded-md border border-slate-200">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#111827] text-white">
                  <th className="px-2.5 py-2 text-left">Designation</th>
                  <th className="px-2 py-2 text-right">Qte</th>
                  <th className="px-2 py-2 text-left">Unite</th>
                  <th className="px-2 py-2 text-right">PU HT</th>
                  <th className="px-2 py-2 text-right">TVA</th>
                  <th className="px-2.5 py-2 text-right">Total HT</th>
                </tr>
              </thead>

              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-center text-slate-500">
                      Aucune ligne.
                    </td>
                  </tr>
                ) : (
                  lines.map((line: any) => {
                    if (line.type === 'section') {
                      return (
                        <tr key={line.id} className="border-b bg-orange-50">
                          <td colSpan={6} className="px-2.5 py-1.5 font-black uppercase text-[#ea580c]">
                            {line.description}
                          </td>
                        </tr>
                      )
                    }

                    if (line.type === 'note') {
                      return (
                        <tr key={line.id} className="border-b border-slate-100">
                          <td colSpan={6} className="px-2.5 py-1.5 italic text-slate-600">
                            {line.description}
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={line.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-2.5 py-1.5 leading-4 text-slate-800">
                          {line.description}
                        </td>
                        <td className="px-2 py-1.5 text-right">{line.quantity}</td>
                        <td className="px-2 py-1.5">{line.unit}</td>
                        <td className="px-2 py-1.5 text-right">{eur(line.unitPriceHt)}</td>
                        <td className="px-2 py-1.5 text-right">{line.vatRate}%</td>
                        <td className="px-2.5 py-1.5 text-right font-black">
                          {eur(line.totalHt ?? lineTotal(line))}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </section>

          <section className="mb-3 grid items-start gap-4 md:grid-cols-[1fr_280px]">
            <div className="min-h-[74px] rounded-md border border-slate-200 bg-[#fbfaf7] p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#f97316]">
                Bon pour accord
              </p>
              <p className="mt-7 text-[11px] text-slate-600">
                Nom, date, cachet et signature du client :
              </p>
            </div>

            <div className="rounded-md bg-[#111827] p-3 text-[11px] text-white">
              <div className="flex justify-between">
                <span>Total HT</span>
                <span className="font-bold">{eur(quote.totalHt)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>TVA</span>
                <span className="font-bold">{eur(quote.totalTva)}</span>
              </div>
              <div className="mt-2 border-t border-white/20 pt-2">
                <div className="flex justify-between text-base font-black text-[#f97316]">
                  <span>Total TTC</span>
                  <span>{eur(quote.totalTtc)}</span>
                </div>
              </div>
            </div>
          </section>

          {quote.paymentTerms && (
            <section className="rounded-md border border-slate-200 bg-[#fbfaf7] p-3">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#f97316]">
                Conditions de paiement
              </p>
              <p className="mt-1 text-[11px] text-slate-700">{quote.paymentTerms}</p>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}

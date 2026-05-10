'use client'

import { useRef, useState } from 'react'
import { trpc } from '@/lib/trpc/client'

type AddressObject = {
  street?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
}

function formatEur(value: unknown) {
  const n = Number(value ?? 0)

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number.isFinite(n) ? n : 0)
}

function formatDate(value: unknown) {
  if (!value) return '-'

  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)

  return d.toLocaleDateString('fr-FR')
}

function formatAddressLines(value: unknown): string[] {
  if (!value) return []

  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  }

  if (typeof value === 'object') {
    const address = value as AddressObject

    const cityLine = [address.postalCode, address.city].filter(Boolean).join(' ')

    return [address.street, cityLine, address.country]
      .map((line) => String(line ?? '').trim())
      .filter(Boolean)
  }

  return [String(value)]
}

function lineTotal(line: any) {
  const qty = Number(line?.quantity ?? 0)
  const unitPrice = Number(line?.unitPriceHt ?? 0)
  const discount = Number(line?.discountPct ?? 0)
  const total = qty * unitPrice * (1 - discount / 100)

  return Number.isFinite(total) ? total : 0
}

export function PublicDevisClient({ id }: { id: string }) {
  const { data, isLoading, error } = trpc.quotes.get.useQuery({ id })
  const pdfRef = useRef<HTMLDivElement | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [logoSrc, setLogoSrc] = useState('/img/logo-lms-icon.svg')

  if (isLoading) {
    return <div className="min-h-screen bg-white p-8 text-slate-600">Chargement du devis...</div>
  }

  if (error || !data?.quote) {
    return <div className="min-h-screen bg-white p-8 text-red-600">Devis introuvable.</div>
  }

  const quote = data.quote
  const lines = data.lines ?? []
  const clientAddressLines = formatAddressLines(quote.clientAddress)

  async function downloadPdf() {
    if (!pdfRef.current) return

    try {
      setIsDownloading(true)

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const safeReference = String(quote.reference ?? id).replace(/[^a-zA-Z0-9_-]/g, '-')
      pdf.save(`devis-${safeReference}.pdf`)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f2ec] px-4 py-5 print:bg-white print:p-0">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 8mm;
        }

        html,
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          background: #ffffff !important;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          main {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .print-hidden {
            display: none !important;
          }

          .print-sheet {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: none !important;
          }
        }
      `}</style>

      <div className="print-hidden mx-auto mb-3 flex max-w-5xl justify-end gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-800 shadow hover:bg-slate-50"
        >
          Imprimer
        </button>

        <button
          type="button"
          onClick={downloadPdf}
          disabled={isDownloading}
          className="rounded-full bg-[#f97316] px-4 py-2 text-xs font-black text-white shadow hover:bg-[#ea580c] disabled:cursor-wait disabled:opacity-70"
        >
          {isDownloading ? 'Generation PDF...' : 'Telecharger PDF'}
        </button>
      </div>

      <section
        ref={pdfRef}
        className="print-sheet relative mx-auto flex max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        style={{ minHeight: '277mm' }}
      >
        <div className="pointer-events-none absolute inset-0 select-none overflow-hidden">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-20deg] text-[180px] font-black tracking-[0.18em] text-slate-200/30">
            DEVIS
          </div>
        </div>

        <div className="relative h-3 bg-[#f97316]" />

        <div className="relative flex flex-1 flex-col p-7 print:p-6">
          <header className="mb-5 grid grid-cols-[1fr_1.15fr] gap-5 border-b border-slate-200 pb-5">
            <section>
              <div className="flex items-center gap-3">
                <img
                  src={logoSrc}
                  alt="La Maison des Services"
                  className="h-16 w-16 object-contain"
                  onError={() => {
                    if (logoSrc !== 'https://www.lamaisondesservices.fr/img/logo-lms-icon.svg') {
                      setLogoSrc('https://www.lamaisondesservices.fr/img/logo-lms-icon.svg')
                    }
                  }}
                />

                <div>
                  <p className="text-2xl font-black leading-none text-[#0f274d]">La Maison</p>
                  <p className="mt-1 text-2xl font-black leading-none text-[#f5a623]">des Services</p>
                </div>
              </div>

              <div className="mt-3 text-[11px] leading-5 text-slate-700">
                <p>420 avenue Blaise Pascal</p>
                <p>34170 Castelnau-le-Lez</p>
                <p>04 65 84 15 94</p>
                <p>devis@lamaisondesservices.fr</p>
                <p>https://lamaisondesservices.fr</p>
                <p>SIRET : 99140452600014</p>
                <p>TVA intra : FR75991404526</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-[#fbfaf7] p-4">
              <div className="mb-3 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f97316]">
                  Document
                </p>
                <h1 className="text-4xl font-black leading-none text-[#111827]">DEVIS</h1>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-slate-200 pt-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-[#f97316]">
                    Client
                  </p>

                  <p className="mt-1 text-sm font-black text-[#111827]">
                    {String(quote.clientName ?? 'Client')}
                  </p>

                  {quote.clientLegalName ? (
                    <p className="text-xs text-slate-600">
                      {String(quote.clientLegalName)}
                    </p>
                  ) : null}

                  {clientAddressLines.length > 0 ? (
                    <div className="mt-1 text-xs text-slate-600">
                      {clientAddressLines.map((line, index) => (
                        <p key={`client-address-${index}`}>{line}</p>
                      ))}
                    </div>
                  ) : null}

                  {quote.clientEmail ? (
                    <p className="text-xs text-slate-600">{String(quote.clientEmail)}</p>
                  ) : null}

                  {quote.clientPhone ? (
                    <p className="text-xs text-slate-600">{String(quote.clientPhone)}</p>
                  ) : null}
                </div>

                <div className="text-right text-[11px] leading-5 text-slate-700">
                  <p>
                    <span className="font-black">Ref :</span> {String(quote.reference ?? '-')}
                  </p>
                  <p>
                    <span className="font-black">Date :</span> {formatDate(quote.issueDate)}
                  </p>
                  <p>
                    <span className="font-black">Validite :</span> {formatDate(quote.expiryDate)}
                  </p>
                  {quote.chantierReference ? (
                    <p>
                      <span className="font-black">Chantier :</span>{' '}
                      {String(quote.chantierReference)}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </header>

          <section className="mb-4 rounded-2xl border-l-4 border-[#f97316] bg-white px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#f97316]">Objet</p>
            <p className="mt-1 text-lg font-bold text-slate-700">{String(quote.subject ?? '-')}</p>
          </section>

          {quote.introText ? (
            <section className="mb-4">
              <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">
                {String(quote.introText)}
              </p>
            </section>
          ) : null}

          <div className="flex flex-1 flex-col">
            <section className="mb-4 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
              <div className="flex h-full flex-col">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="px-3 py-3 text-left font-bold">Designation</th>
                      <th className="px-2 py-3 text-right font-bold">Qte</th>
                      <th className="px-2 py-3 text-left font-bold">Unite</th>
                      <th className="px-2 py-3 text-right font-bold">PU HT</th>
                      <th className="px-2 py-3 text-right font-bold">TVA</th>
                      <th className="px-3 py-3 text-right font-bold">Total HT</th>
                    </tr>
                  </thead>

                  <tbody>
                    {lines.map((line: any, index: number) => {
                      const key = line.id ?? `line-${index}`

                      if (line.type === 'section') {
                        return (
                          <tr key={key} className="border-t border-slate-200 bg-orange-50/80">
                            <td colSpan={6} className="px-3 py-2 font-black uppercase text-[#ea580c]">
                              {String(line.description ?? '')}
                            </td>
                          </tr>
                        )
                      }

                      if (line.type === 'note') {
                        return (
                          <tr key={key} className="border-t border-slate-100">
                            <td colSpan={6} className="px-3 py-2 italic text-slate-600">
                              {String(line.description ?? '')}
                            </td>
                          </tr>
                        )
                      }

                      const totalHt = line.totalHt ?? lineTotal(line)

                      return (
                        <tr key={key} className="border-t border-slate-100">
                          <td className="px-3 py-2 leading-5 text-slate-800">
                            {String(line.description ?? '')}
                          </td>
                          <td className="px-2 py-2 text-right">{String(line.quantity ?? 0)}</td>
                          <td className="px-2 py-2">{String(line.unit ?? 'u')}</td>
                          <td className="px-2 py-2 text-right">{formatEur(line.unitPriceHt)}</td>
                          <td className="px-2 py-2 text-right">{String(line.vatRate ?? 0)}%</td>
                          <td className="px-3 py-2 text-right font-black text-slate-900">
                            {formatEur(totalHt)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <div className="flex-1" />
              </div>
            </section>

            <section className="mt-auto flex items-end gap-5">
              <div className="min-h-[118px] flex-1 rounded-2xl border border-slate-200 bg-[#fbfaf7] p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#f97316]">
                  Bon pour accord
                </p>
                <p className="mt-10 text-xs text-slate-600">
                  Nom, date, cachet et signature du client :
                </p>
              </div>

              <div className="w-[310px] rounded-2xl bg-white p-4">
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Total HT</span>
                  <span className="font-medium text-slate-700">{formatEur(quote.totalHt)}</span>
                </div>

                <div className="mt-2 flex justify-between text-sm text-slate-500">
                  <span>TVA</span>
                  <span className="font-medium text-slate-700">{formatEur(quote.totalTva)}</span>
                </div>

                <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-[20px] font-black text-[#f97316]">
                  <span>Total TTC</span>
                  <span>{formatEur(quote.totalTtc)}</span>
                </div>
              </div>
            </section>
          </div>

          <footer className="mt-4 border-t border-slate-200 pt-3 text-center text-[10px] leading-4 text-slate-500">
            La Maison des Services · 420 avenue Blaise Pascal · 34170 Castelnau-le-Lez · 04 65 84 15 94
            <br />
            devis@lamaisondesservices.fr · lamaisondesservices.fr · SIRET : 99140452600014 · TVA : FR75991404526
          </footer>
        </div>
      </section>
    </main>
  )
}
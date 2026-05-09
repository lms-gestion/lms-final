'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { trpc } from '@/lib/trpc/client'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'brouillon', label: 'Brouillons' },
  { value: 'envoye', label: 'Envoyes' },
  { value: 'consulte', label: 'Consultes' },
  { value: 'accepte', label: 'Acceptes' },
  { value: 'refuse', label: 'Refuses' },
  { value: 'expire', label: 'Expires' },
] as const

const STATUS_BADGE: Record<string, string> = {
  brouillon: 'bg-slate-100 text-slate-700 border-slate-200',
  envoye: 'bg-blue-100 text-blue-800 border-blue-200',
  consulte: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  accepte: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  refuse: 'bg-red-100 text-red-800 border-red-200',
  expire: 'bg-amber-100 text-amber-800 border-amber-200',
}

function formatEur(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  const num = typeof value === 'string' ? Number.parseFloat(value) : value
  if (Number.isNaN(num)) return '-'
  return num.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('fr-FR')
}

export function QuotesListClient() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const { data: quotes = [], isLoading } = trpc.quotes.list.useQuery(
    statusFilter === 'all'
      ? undefined
      : { status: statusFilter as 'brouillon' | 'envoye' | 'consulte' | 'accepte' | 'refuse' | 'expire' },
  )
  const { data: stats } = trpc.quotes.stats.useQuery()

  const filtered = useMemo(() => {
    if (!search.trim()) return quotes
    const q = search.toLowerCase()
    return quotes.filter(
      (item) =>
        item.reference.toLowerCase().includes(q) ||
        (item.subject ?? '').toLowerCase().includes(q) ||
        (item.clientName ?? '').toLowerCase().includes(q),
    )
  }, [quotes, search])

  const totalEnAttente = (stats?.envoye?.totalTtc ?? 0) + (stats?.consulte?.totalTtc ?? 0)
  const totalAccepte = stats?.accepte?.totalTtc ?? 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Devis</h1>
          <p className="text-sm text-slate-500">
            {quotes.length} devis affiches
            {totalEnAttente > 0 ? ` - en attente : ${formatEur(totalEnAttente)}` : ''}
            {totalAccepte > 0 ? ` - acceptes : ${formatEur(totalAccepte)}` : ''}
          </p>
        </div>
        <Link
          href="/devis/new"
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
        >
          + Nouveau devis
        </Link>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par reference, objet ou client..."
            className="min-w-[260px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  statusFilter === opt.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-500">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="mb-2 text-base font-semibold text-slate-700">Aucun devis</p>
            <p className="mb-4 text-sm text-slate-500">
              {search || statusFilter !== 'all'
                ? 'Aucun devis ne correspond aux filtres.'
                : 'Creez votre premier devis pour demarrer.'}
            </p>
            <Link
              href="/devis/new"
              className="inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              + Nouveau devis
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                  Statut
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                  Client
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                  Objet
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                  Emis le
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                  Expire le
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
                  Total TTC
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 last:border-b-0 hover:bg-blue-50/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/devis/${q.id}`} className="font-semibold text-slate-900 hover:underline">
                      {q.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${
                        STATUS_BADGE[q.status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{q.clientName ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{q.subject}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(q.issueDate)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(q.expiryDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatEur(q.totalTtc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

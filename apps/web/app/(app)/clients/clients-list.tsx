'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Users, Building2, Home, Shield, Briefcase, Hotel, User } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatEur, formatRelativeTime, CLIENT_TYPES } from '@lms/shared'
import { CreateClientDialog } from './create-client-dialog'

const TYPE_ICONS = {
  syndic: Building2,
  bailleur: Home,
  copropriete: Users,
  assurance: Shield,
  tertiaire: Briefcase,
  hotellerie: Hotel,
  particulier: User,
} as const

const TYPE_VARIANTS = {
  syndic: 'blue',
  bailleur: 'purple',
  copropriete: 'green',
  assurance: 'amber',
  tertiaire: 'gray',
  hotellerie: 'pink',
  particulier: 'orange',
} as const

export function ClientsList() {
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string[]>([])

  const stats = trpc.clients.stats.useQuery()
  const list = trpc.clients.list.useQuery({
    search: search || undefined,
    type: (typeFilter.length > 0 ? typeFilter : undefined) as never,
    page: 1,
    pageSize: 50,
  })

  const utils = trpc.useUtils()

  function toggleTypeFilter(type: string) {
    setTypeFilter((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  function paymentScoreVariant(score: number | null) {
    if (score === null) return 'gray'
    if (score >= 80) return 'green'
    if (score >= 50) return 'amber'
    return 'red'
  }

  function paymentScoreLabel(score: number | null) {
    if (score === null) return '—'
    if (score >= 80) return `Bon (${score})`
    if (score >= 50) return `Moyen (${score})`
    return `Mauvais (${score})`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">👥 Clients & Syndics</h1>
          <p className="text-sm text-muted-foreground">
            {stats.data?.actifs ?? 0} clients actifs
            {stats.data?.ca12mois ? ` · ${formatEur(stats.data.ca12mois)} de CA cumulé sur 12 mois` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">📥 Importer CSV</Button>
          <Button variant="orange" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nouveau client
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, SIRET, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {CLIENT_TYPES.map((t) => (
                <button
                  key={t.code}
                  onClick={() => toggleTypeFilter(t.code)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                    typeFilter.includes(t.code)
                      ? 'bg-brand-blue text-white border-brand-blue'
                      : 'bg-background border-border text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Chargement des clients…</div>
          ) : !list.data || list.data.items.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-lg font-semibold">Aucun client</p>
              <p className="text-sm text-muted-foreground mb-4">
                {search || typeFilter.length > 0
                  ? 'Aucun résultat ne correspond aux filtres.'
                  : 'Ajoutez votre premier client pour commencer.'}
              </p>
              <Button variant="orange" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nouveau client
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>SIRET</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Statut payeur</TableHead>
                  <TableHead>Créé</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((c) => {
                  const TypeIcon = TYPE_ICONS[c.type as keyof typeof TYPE_ICONS] ?? User
                  const typeLabel =
                    CLIENT_TYPES.find((t) => t.code === c.type)?.label ?? c.type
                  return (
                    <TableRow key={c.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/clients/${c.id}`} className="block hover:text-brand-blue-mid">
                          <div className="font-semibold">{c.name}</div>
                          {c.legalName && c.legalName !== c.name && (
                            <div className="text-xs text-muted-foreground">{c.legalName}</div>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={TYPE_VARIANTS[c.type as keyof typeof TYPE_VARIANTS] as never}>
                          <TypeIcon className="h-3 w-3 mr-1" />
                          {typeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.siret ?? '—'}</TableCell>
                      <TableCell className="text-sm">
                        {c.paymentTermsDays !== null ? `${c.paymentTermsDays} j` : '—'}
                      </TableCell>
                      <TableCell>
                        {c.paymentStatusOverride === 'blocked' ? (
                          <Badge variant="red">⚫ Bloqué</Badge>
                        ) : (
                          <Badge variant={paymentScoreVariant(c.paymentStatusScore) as never}>
                            {paymentScoreLabel(c.paymentStatusScore)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelativeTime(c.createdAt)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          utils.clients.list.invalidate()
          utils.clients.stats.invalidate()
        }}
      />
    </div>
  )
}

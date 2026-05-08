'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Briefcase, FileText, Receipt, MapPin, Users, FileArchive, History, Edit, Archive } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatEur, formatDate, formatPhoneFr, CLIENT_TYPES } from '@lms/shared'

export function ClientFiche({ id }: { id: string }) {
  const router = useRouter()
  const query = trpc.clients.get.useQuery({ id })

  if (query.isLoading) {
    return <div className="text-muted-foreground">Chargement…</div>
  }

  if (query.error || !query.data) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-semibold">Client introuvable</p>
        <p className="text-sm text-muted-foreground mb-4">
          Ce client n'existe pas ou vous n'y avez pas accès.
        </p>
        <Button variant="outline" onClick={() => router.push('/clients')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour à la liste
        </Button>
      </div>
    )
  }

  const c = query.data
  const typeInfo = CLIENT_TYPES.find((t) => t.code === c.type)
  const isArchived = !!c.archivedAt

  return (
    <div>
      {/* Breadcrumb */}
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="h-3 w-3" /> Clients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{c.name}</h1>
            <Badge variant="blue">{typeInfo?.label ?? c.type}</Badge>
            {isArchived && <Badge variant="gray">Archivé</Badge>}
          </div>
          {c.legalName && c.legalName !== c.name && (
            <p className="text-sm text-muted-foreground mt-1">{c.legalName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-1" /> Modifier
          </Button>
          {!isArchived && (
            <Button variant="outline" size="sm">
              <Archive className="h-4 w-4 mr-1" /> Archiver
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">CA cumulé</p>
            <p className="text-2xl font-bold mt-1">{formatEur(c.stats.caTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              dont {formatEur(c.stats.ca12mois)} sur 12 mois
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Encours impayé</p>
            <p className={`text-2xl font-bold mt-1 ${c.stats.encoursImpaye > 0 ? 'text-red-600' : ''}`}>
              {formatEur(c.stats.encoursImpaye)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Chantiers actifs</p>
            <p className="text-2xl font-bold mt-1">{c.stats.chantiersActifs}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {c.stats.chantiersTotal} au total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Factures</p>
            <p className="text-2xl font-bold mt-1">{c.stats.nbFactures}</p>
          </CardContent>
        </Card>
      </div>

      {/* Onglets */}
      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos">📋 Informations</TabsTrigger>
          <TabsTrigger value="lieux">
            <MapPin className="h-4 w-4 mr-1" /> Lieux
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <Users className="h-4 w-4 mr-1" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="chantiers">
            <Briefcase className="h-4 w-4 mr-1" /> Chantiers
          </TabsTrigger>
          <TabsTrigger value="devis">
            <FileText className="h-4 w-4 mr-1" /> Devis
          </TabsTrigger>
          <TabsTrigger value="factures">
            <Receipt className="h-4 w-4 mr-1" /> Factures
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileArchive className="h-4 w-4 mr-1" /> Documents
          </TabsTrigger>
          <TabsTrigger value="historique">
            <History className="h-4 w-4 mr-1" /> Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="infos">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Type" value={typeInfo?.label ?? c.type} />
                <Row label="Raison sociale" value={c.legalName} />
                <Row label="Forme juridique" value={c.legalForm} />
                <Row label="SIRET" value={c.siret} mono />
                <Row label="N° TVA intra" value={c.tvaIntra} mono />
                <Row label="Code APE" value={c.apeCode} />
                {c.cardProGT && <Row label="Carte pro G/T" value={c.cardProGT} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coordonnées</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row
                  label="Adresse"
                  value={[c.address?.street, c.address?.postalCode, c.address?.city].filter(Boolean).join(' · ')}
                />
                <Row label="Téléphone" value={c.phone ? formatPhoneFr(c.phone) : null} />
                <Row label="Email" value={c.email} />
                <Row label="Site web" value={c.website} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conditions commerciales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Délai de paiement" value={c.paymentTermsDays !== null ? `${c.paymentTermsDays} jours` : '—'} />
                <Row label="Mode de paiement" value={c.paymentMethod} />
                <Row label="Statut payeur" value={`Score ${c.paymentStatusScore}/100`} />
                {c.chorusProRequired && (
                  <Row label="Chorus Pro" value="Obligatoire" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {c.notes ? (
                  <p className="text-sm whitespace-pre-wrap">{c.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aucune note</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="lieux">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun lieu d'intervention enregistré</p>
              <p className="text-xs mt-1">Module à venir au Sprint 4</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun contact</p>
              <p className="text-xs mt-1">Module à venir au Sprint 4</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chantiers">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun chantier</p>
              <p className="text-xs mt-1">Module à venir au Sprint 5-6</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devis">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun devis</p>
              <p className="text-xs mt-1">Module à venir au Sprint 8-9</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="factures">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucune facture</p>
              <p className="text-xs mt-1">Module à venir au Sprint 10-11</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileArchive className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun document</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historique">
          <Card>
            <CardContent className="py-6">
              <ul className="text-sm space-y-2">
                <li className="flex items-center justify-between border-b pb-2">
                  <span>Client créé</span>
                  <span className="text-muted-foreground">{formatDate(c.createdAt)}</span>
                </li>
                {c.archivedAt && (
                  <li className="flex items-center justify-between border-b pb-2">
                    <span>Archivé</span>
                    <span className="text-muted-foreground">{formatDate(c.archivedAt)}</span>
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={`${mono ? 'font-mono' : ''} ${value ? '' : 'text-muted-foreground italic'}`}>
        {value || '—'}
      </p>
    </div>
  )
}

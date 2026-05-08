import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Tableau de bord' }

export default function DashboardPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Bienvenue dans LMS Gestion.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Chantiers actifs', value: '0' },
          { label: 'Clients enregistrés', value: '0' },
          { label: 'Techniciens', value: '0' },
          { label: 'Factures impayées', value: '0 €' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">🎉 Bienvenue !</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Votre application est prête. Les modules métier seront implémentés au fur et à mesure des sprints.
            Voir <code>docs/specs/</code> pour la spec produit complète et <code>SETUP.md</code> à la racine pour
            le guide de démarrage.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

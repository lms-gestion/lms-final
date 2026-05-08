import { Suspense } from 'react'
import { ClientsList } from './clients-list'

export const metadata = { title: 'Clients & Syndics' }

export default function ClientsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <Suspense fallback={<div className="text-muted-foreground">Chargement…</div>}>
        <ClientsList />
      </Suspense>
    </div>
  )
}

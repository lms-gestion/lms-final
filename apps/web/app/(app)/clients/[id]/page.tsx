import { notFound } from 'next/navigation'
import { ClientFiche } from './client-fiche'

export default function ClientDetailPage({ params }: { params: { id: string } }) {
  if (!params.id || params.id.length < 8) notFound()
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <ClientFiche id={params.id} />
    </div>
  )
}

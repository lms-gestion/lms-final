import { ChantierDetailClient } from './chantier-detail-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function ChantierDetailPage({ params }: { params: { id: string } }) {
  return <ChantierDetailClient id={params.id} />
}

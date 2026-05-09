import { QuoteDetailClient } from './quote-detail-client'

export const metadata = { title: 'Devis' }

export default function QuoteDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <QuoteDetailClient id={params.id} />
    </div>
  )
}

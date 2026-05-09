import { QuotePreviewClient } from './quote-preview-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function QuotePreviewPage({ params }: { params: { id: string } }) {
  return <QuotePreviewClient id={params.id} />
}

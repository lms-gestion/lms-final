import { QuoteCreateClient } from './quote-create-client'

export const metadata = { title: 'Nouveau devis' }

export default function NewQuotePage({
  searchParams,
}: {
  searchParams: { chantierId?: string; clientId?: string }
}) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <QuoteCreateClient
        chantierId={searchParams.chantierId}
        clientId={searchParams.clientId}
      />
    </div>
  )
}

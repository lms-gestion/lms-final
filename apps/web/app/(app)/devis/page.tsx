import { QuotesListClient } from './quotes-list-client'

export const metadata = { title: 'Devis' }

export default function DevisPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <QuotesListClient />
    </div>
  )
}
